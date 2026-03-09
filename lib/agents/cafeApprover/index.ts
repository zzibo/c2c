/**
 * Cafe Approver Agent - Main Orchestrator
 * Processes pending cafe submissions using rule-based logic + Claude API for borderline cases
 */

import { supabaseAdmin } from '@/lib/supabase-server';
import {
  PendingSubmission,
  ParsedSubmission,
  ScrapedCafeData,
  ExistingCafe,
  ProcessingResult,
  CafeApproverConfig,
  AgentRunSummary,
  ClaudeDecision,
  Coordinate,
} from './types';
import { MAX_SUBMISSIONS_PER_RUN, DUPLICATE_CHECK_RADIUS_METERS, DUPLICATE_NAME_THRESHOLD, HARD_REJECT_DISTANCE_METERS, HARD_REJECT_NAME_THRESHOLD } from './constants';
import { parsePostGISPoint, classifySubmission, calculateNameSimilarity, calculateDistanceMeters } from './validation';
import { scrapeWithRetry, isValidGoogleMapsUrl } from './scraper';
import { evaluateWithClaude } from './claude';

/**
 * Fetch pending submissions from database
 */
export async function fetchPendingSubmissions(limit: number): Promise<PendingSubmission[]> {
  const { data, error } = await supabaseAdmin
    .from('user_submitted_cafes')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) // Process oldest first
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch pending submissions: ${error.message}`);
  }

  return data || [];
}

/**
 * Parse a submission's PostGIS location to coordinates
 */
function parseSubmission(submission: PendingSubmission): ParsedSubmission | null {
  const location = parsePostGISPoint(submission.location);
  if (!location) {
    console.error(`  Failed to parse location for submission ${submission.id}`);
    return null;
  }

  return {
    ...submission,
    location,
  };
}

/**
 * Find existing cafe near the given location with similar name
 * Queries the cafes table directly (not materialized view) to catch recent additions
 */
export async function findExistingCafe(
  name: string,
  location: Coordinate
): Promise<ExistingCafe | null> {
  // Query cafes table directly using PostGIS ST_DWithin for distance check
  // This catches cafes that were just added (before materialized view refresh)
  const { data, error } = await supabaseAdmin.rpc('find_duplicate_cafe', {
    search_name: name,
    search_lat: location.lat,
    search_lng: location.lng,
    radius_meters: DUPLICATE_CHECK_RADIUS_METERS,
  });

  if (error) {
    // If the RPC doesn't exist, fall back to simple name-based check
    if (error.message.includes('find_duplicate_cafe')) {
      console.log('  find_duplicate_cafe RPC not found, using fallback...');
      return findExistingCafeFallback(name, location);
    }
    console.error(`  Error checking for existing cafes: ${error.message}`);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Find best match by name similarity
  for (const cafe of data) {
    const similarity = calculateNameSimilarity(name, cafe.name);
    if (similarity >= DUPLICATE_NAME_THRESHOLD) {
      console.log(`  Found duplicate: "${cafe.name}" (${similarity.toFixed(1)}% match)`);
      return {
        id: cafe.id,
        name: cafe.name,
        location: cafe.location,
        address: cafe.address,
      };
    }
  }

  return null;
}

/**
 * Fallback duplicate check - queries cafes table with simple name match
 */
async function findExistingCafeFallback(
  name: string,
  location: Coordinate
): Promise<ExistingCafe | null> {
  // Normalize the name for searching
  const searchTerms = name.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  if (searchTerms.length === 0) {
    return null;
  }

  // Search for cafes with similar names
  const { data, error } = await supabaseAdmin
    .from('cafes')
    .select('id, name, location, address')
    .ilike('name', `%${searchTerms[0]}%`)
    .limit(20);

  if (error) {
    console.error(`  Fallback duplicate check error: ${error.message}`);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // Check each result for name similarity and distance
  for (const cafe of data) {
    const similarity = calculateNameSimilarity(name, cafe.name);
    if (similarity >= DUPLICATE_NAME_THRESHOLD) {
      // Parse cafe location and check distance
      const cafeLocation = parsePostGISPoint(cafe.location);
      if (cafeLocation) {
        const distance = calculateDistanceMeters(location, cafeLocation);
        if (distance <= DUPLICATE_CHECK_RADIUS_METERS) {
          console.log(`  Found duplicate (fallback): "${cafe.name}" (${similarity.toFixed(1)}% match, ${distance}m away)`);
          return {
            id: cafe.id,
            name: cafe.name,
            location: cafe.location,
            address: cafe.address,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Create a new cafe in the database from scraped data
 */
export async function createCafe(scrapedData: ScrapedCafeData): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('cafes')
    .insert({
      geoapify_place_id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: scrapedData.name,
      address: scrapedData.address,
      location: `POINT(${scrapedData.location.lng} ${scrapedData.location.lat})`,
      phone: scrapedData.phone || null,
      website: scrapedData.website || null,
      user_photos: scrapedData.photos,
      verified_hours: scrapedData.hours || null,
      first_discovered_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create cafe: ${error.message}`);
  }

  return data.id;
}

/**
 * Update submission status in database
 */
export async function updateSubmissionStatus(
  id: string,
  status: 'approved' | 'rejected',
  notes: string,
  cafeId?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    review_notes: notes,
    reviewed_at: new Date().toISOString(),
  };

  if (cafeId) {
    updateData.approved_cafe_id = cafeId;
  }

  const { error } = await supabaseAdmin
    .from('user_submitted_cafes')
    .update(updateData)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update submission status: ${error.message}`);
  }
}

/**
 * Process a single submission
 */
export async function processSubmission(
  submission: PendingSubmission,
  config: CafeApproverConfig
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    submissionId: submission.id,
    success: false,
    action: 'error',
    notes: '',
    usedClaude: false,
  };

  try {
    // 1. Parse submission location
    const parsed = parseSubmission(submission);
    if (!parsed) {
      result.notes = 'Failed to parse submission location';
      return result;
    }

    // 2. Validate Google Maps URL
    if (!isValidGoogleMapsUrl(submission.google_maps_link)) {
      result.action = 'flagged';
      result.notes = 'Invalid Google Maps URL format';
      if (!config.dryRun) {
        await updateSubmissionStatus(submission.id, 'rejected', result.notes);
      }
      result.success = true;
      return result;
    }

    // 3. Scrape Google Maps
    let scrapedData: ScrapedCafeData;
    try {
      scrapedData = await scrapeWithRetry(submission.google_maps_link);
    } catch (scrapeError) {
      result.action = 'flagged';
      result.notes = `Scraping failed: ${scrapeError instanceof Error ? scrapeError.message : 'Unknown error'}`;
      // Don't reject - leave as pending for retry later
      result.success = true;
      return result;
    }

    // 4. FIRST: Compare user input vs scraped data (validate user's submission)
    const validation = classifySubmission(parsed, scrapedData);
    result.nameMatchScore = validation.nameMatchScore;
    result.distanceMeters = validation.distanceMeters;

    console.log(`  User input: "${parsed.name}" at (${parsed.location.lat.toFixed(6)}, ${parsed.location.lng.toFixed(6)})`);
    console.log(`  Google Maps: "${scrapedData.name}" at (${scrapedData.location.lat.toFixed(6)}, ${scrapedData.location.lng.toFixed(6)})`);
    console.log(`  Comparison: ${validation.nameMatchScore}% name match, ${validation.distanceMeters}m apart`);
    console.log(`  Place type: ${scrapedData.placeType || 'Unknown'}`);

    // 4a. Hard reject if name doesn't match (<40% similarity)
    if (validation.nameMatchScore < HARD_REJECT_NAME_THRESHOLD) {
      result.action = 'rejected';
      result.notes = `Name mismatch: You entered "${parsed.name}" but Google Maps says "${scrapedData.name}" (${validation.nameMatchScore}% match, min required: ${HARD_REJECT_NAME_THRESHOLD}%)`;
      if (!config.dryRun) {
        await updateSubmissionStatus(submission.id, 'rejected', result.notes);
      }
      result.success = true;
      return result;
    }

    // 4b. Hard reject if location is way off (>1km)
    if (validation.distanceMeters > HARD_REJECT_DISTANCE_METERS) {
      result.action = 'rejected';
      result.notes = `Location mismatch: Your pin is ${validation.distanceMeters}m away from the actual cafe (max allowed: ${HARD_REJECT_DISTANCE_METERS}m)`;
      if (!config.dryRun) {
        await updateSubmissionStatus(submission.id, 'rejected', result.notes);
      }
      result.success = true;
      return result;
    }

    // 5. THEN: Check for existing cafe (duplicate detection) - only after user input is validated
    const existingCafe = await findExistingCafe(scrapedData.name, scrapedData.location);
    if (existingCafe) {
      result.action = 'approved';
      result.cafeId = existingCafe.id;
      result.notes = `Linked to existing cafe: "${existingCafe.name}" (already in database)`;
      if (!config.dryRun) {
        await updateSubmissionStatus(submission.id, 'approved', result.notes, existingCafe.id);
      }
      result.success = true;
      return result;
    }

    // 6. ALWAYS use Claude API to verify it's actually a cafe
    // Rule-based matching is not enough - we need to verify the place type
    console.log('  Using Claude API to verify submission...');
    result.usedClaude = true;

    let claudeDecision: ClaudeDecision;
    try {
      claudeDecision = await evaluateWithClaude(
        { name: parsed.name, location: parsed.location },
        { name: scrapedData.name, address: scrapedData.address, location: scrapedData.location, placeType: scrapedData.placeType },
        validation.nameMatchScore,
        validation.distanceMeters
      );
    } catch (claudeError) {
      // Claude API failed — flag for manual review instead of rejecting
      const errorMsg = claudeError instanceof Error ? claudeError.message : 'Unknown error';
      console.error(`  ⚠️ Claude API failed, flagging for manual review: ${errorMsg}`);
      result.action = 'flagged';
      result.notes = `Claude API unavailable: ${errorMsg}. Left in pending for retry.`;
      // Do NOT update submission status — leave as 'pending' for next cron run
      return result;
    }

    console.log(`  Claude decision: ${claudeDecision.approve ? 'APPROVE' : 'REJECT'}`);
    console.log(`  Reasoning: ${claudeDecision.reasoning}`);

    if (claudeDecision.approve) {
      let cafeId: string | undefined;
      if (!config.dryRun) {
        cafeId = await createCafe(scrapedData);
        await updateSubmissionStatus(
          submission.id,
          'approved',
          `Approved: ${claudeDecision.reasoning}`,
          cafeId
        );
        // Immediately refresh materialized view so cafe appears on map
        const { error: refreshError } = await supabaseAdmin.rpc('refresh_cafe_stats');
        if (refreshError) {
          console.error('  ⚠️ Failed to refresh cafe_stats:', refreshError);
        } else {
          console.log('  ✅ Refreshed cafe_stats - cafe now visible on map');
        }
      }
      result.action = 'approved';
      result.cafeId = cafeId;
      result.notes = `Approved: ${claudeDecision.reasoning}`;
      result.success = true;
    } else {
      result.action = 'rejected';
      result.notes = `Rejected: ${claudeDecision.reasoning}`;
      if (!config.dryRun) {
        await updateSubmissionStatus(submission.id, 'rejected', result.notes);
      }
      result.success = true;
    }

    return result;
  } catch (error) {
    result.notes = `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`  Error: ${result.notes}`);
    return result;
  }
}

/**
 * Main entry point - run the cafe approver agent
 */
export async function runCafeApproverAgent(
  config: Partial<CafeApproverConfig> = {}
): Promise<AgentRunSummary> {
  const fullConfig: CafeApproverConfig = {
    dryRun: config.dryRun ?? false,
    limit: config.limit ?? MAX_SUBMISSIONS_PER_RUN,
    verbose: config.verbose ?? true,
  };

  const summary: AgentRunSummary = {
    startedAt: new Date(),
    completedAt: new Date(),
    totalProcessed: 0,
    approved: 0,
    rejected: 0,
    flagged: 0,
    errors: 0,
    claudeApiCalls: 0,
    results: [],
  };

  console.log('========================================');
  console.log('  Cafe Approver Agent');
  console.log('========================================');
  console.log(`Mode: ${fullConfig.dryRun ? 'DRY RUN (no DB changes)' : 'LIVE'}`);
  console.log(`Limit: ${fullConfig.limit} submissions\n`);

  // Fetch pending submissions
  console.log('Fetching pending submissions...');
  const submissions = await fetchPendingSubmissions(fullConfig.limit);
  console.log(`Found ${submissions.length} pending submission(s)\n`);

  if (submissions.length === 0) {
    console.log('No pending submissions to process.');
    summary.completedAt = new Date();
    return summary;
  }

  // Process each submission
  for (let i = 0; i < submissions.length; i++) {
    const submission = submissions[i];
    console.log(`----------------------------------------`);
    console.log(`[${i + 1}/${submissions.length}] Processing: "${submission.name}"`);
    console.log(`  ID: ${submission.id}`);
    console.log(`  Link: ${submission.google_maps_link}`);

    const result = await processSubmission(submission, fullConfig);
    summary.results.push(result);
    summary.totalProcessed++;

    if (result.usedClaude) {
      summary.claudeApiCalls++;
    }

    switch (result.action) {
      case 'approved':
        summary.approved++;
        console.log(`  Result: APPROVED`);
        break;
      case 'rejected':
        summary.rejected++;
        console.log(`  Result: REJECTED`);
        break;
      case 'flagged':
        summary.flagged++;
        console.log(`  Result: FLAGGED FOR REVIEW`);
        break;
      case 'error':
        summary.errors++;
        console.log(`  Result: ERROR`);
        break;
    }
    console.log(`  Notes: ${result.notes}`);

    // Brief pause between submissions to avoid rate limiting
    if (i < submissions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  summary.completedAt = new Date();

  // Print summary
  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`Total processed: ${summary.totalProcessed}`);
  console.log(`Approved: ${summary.approved}`);
  console.log(`Rejected: ${summary.rejected}`);
  console.log(`Flagged: ${summary.flagged}`);
  console.log(`Errors: ${summary.errors}`);
  console.log(`Claude API calls: ${summary.claudeApiCalls}`);
  console.log(`Duration: ${(summary.completedAt.getTime() - summary.startedAt.getTime()) / 1000}s`);
  console.log('========================================\n');

  // Refresh cafe stats if any cafes were approved
  if (summary.approved > 0 && !fullConfig.dryRun) {
    const { error: finalRefreshError } = await supabaseAdmin.rpc('refresh_cafe_stats');
    if (finalRefreshError) {
      console.error('Failed to refresh cafe stats:', finalRefreshError);
    } else {
      console.log('Refreshed cafe stats materialized view.');
    }
  }

  return summary;
}
