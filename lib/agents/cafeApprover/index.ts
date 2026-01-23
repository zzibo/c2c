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
  Coordinate,
} from './types';
import { MAX_SUBMISSIONS_PER_RUN, DUPLICATE_CHECK_RADIUS_METERS, DUPLICATE_NAME_THRESHOLD } from './constants';
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
 */
export async function findExistingCafe(
  name: string,
  location: Coordinate
): Promise<ExistingCafe | null> {
  // Query cafes within duplicate check radius
  const { data, error } = await supabaseAdmin.rpc('get_nearby_cafes', {
    user_lat: location.lat,
    user_lng: location.lng,
    radius_meters: DUPLICATE_CHECK_RADIUS_METERS,
    min_rating: 0,
    result_limit: 20,
  });

  if (error) {
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
 * Create a new cafe in the database from scraped data
 */
export async function createCafe(scrapedData: ScrapedCafeData): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('cafes')
    .insert({
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

    // 4. Check for existing cafe (duplicate detection)
    const existingCafe = await findExistingCafe(scrapedData.name, scrapedData.location);
    if (existingCafe) {
      result.action = 'approved';
      result.cafeId = existingCafe.id;
      result.notes = `Linked to existing cafe: "${existingCafe.name}" (ID: ${existingCafe.id})`;
      if (!config.dryRun) {
        await updateSubmissionStatus(submission.id, 'approved', result.notes, existingCafe.id);
      }
      result.success = true;
      return result;
    }

    // 5. Classify submission
    const validation = classifySubmission(parsed, scrapedData);
    result.nameMatchScore = validation.nameMatchScore;
    result.distanceMeters = validation.distanceMeters;

    console.log(`  Classification: ${validation.classification}`);
    console.log(`  Name match: ${validation.nameMatchScore}%, Distance: ${validation.distanceMeters}m`);

    // 6. Handle based on classification
    if (validation.classification === 'clear_match') {
      // Auto-approve
      let cafeId: string | undefined;
      if (!config.dryRun) {
        cafeId = await createCafe(scrapedData);
        await updateSubmissionStatus(
          submission.id,
          'approved',
          `Auto-approved: ${validation.nameMatchScore}% name match, ${validation.distanceMeters}m distance`,
          cafeId
        );
      }
      result.action = 'approved';
      result.cafeId = cafeId;
      result.notes = `Auto-approved (clear match): ${validation.nameMatchScore}% name, ${validation.distanceMeters}m`;
      result.success = true;
    } else if (validation.classification === 'clear_mismatch') {
      // Flag for manual review
      result.action = 'flagged';
      result.notes = `Flagged (clear mismatch): ${validation.nameMatchScore}% name, ${validation.distanceMeters}m. Submission: "${parsed.name}" vs Scraped: "${scrapedData.name}"`;
      if (!config.dryRun) {
        await updateSubmissionStatus(submission.id, 'rejected', result.notes);
      }
      result.success = true;
    } else {
      // Borderline - use Claude API
      console.log('  Using Claude API for borderline decision...');
      result.usedClaude = true;

      const claudeDecision = await evaluateWithClaude(
        { name: parsed.name, location: parsed.location },
        { name: scrapedData.name, address: scrapedData.address, location: scrapedData.location },
        validation.nameMatchScore,
        validation.distanceMeters
      );

      console.log(`  Claude decision: ${claudeDecision.approve ? 'APPROVE' : 'FLAG'}`);
      console.log(`  Reasoning: ${claudeDecision.reasoning}`);

      if (claudeDecision.approve) {
        let cafeId: string | undefined;
        if (!config.dryRun) {
          cafeId = await createCafe(scrapedData);
          await updateSubmissionStatus(
            submission.id,
            'approved',
            `Claude-approved: ${claudeDecision.reasoning}`,
            cafeId
          );
        }
        result.action = 'approved';
        result.cafeId = cafeId;
        result.notes = `Claude-approved: ${claudeDecision.reasoning}`;
        result.success = true;
      } else {
        result.action = 'flagged';
        result.notes = `Claude-flagged: ${claudeDecision.reasoning}`;
        if (!config.dryRun) {
          await updateSubmissionStatus(submission.id, 'rejected', result.notes);
        }
        result.success = true;
      }
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
    try {
      await supabaseAdmin.rpc('refresh_cafe_stats');
      console.log('Refreshed cafe stats materialized view.');
    } catch (error) {
      console.error('Failed to refresh cafe stats:', error);
    }
  }

  return summary;
}
