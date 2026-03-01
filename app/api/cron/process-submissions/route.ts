/**
 * Cron endpoint for automated cafe submission processing
 *
 * This endpoint is triggered by Vercel Cron to periodically process
 * pending cafe submissions using the cafe approver agent.
 *
 * Security: Requires CRON_SECRET in Authorization header
 * Frequency: Once daily at 9 AM UTC (configured in vercel.json)
 *
 * COST SAFEGUARDS:
 * - Hard limit of 5 cafes per day (MAX_DAILY_CAFES)
 * - Tracks daily usage to prevent exceeding limit
 * - Single batch processing (no loops)
 * - Kill switch via DISABLE_CRON_AI env var
 */

import { NextRequest, NextResponse } from 'next/server';
import { runCafeApproverAgent } from '@/lib/agents/cafeApprover';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// COST CONTROL CONSTANTS - CHANGE THESE TO CONTROL SPENDING
// ============================================================================
const MAX_DAILY_CAFES = 5; // Maximum cafes to process per day
const MAX_EXECUTION_TIME_MS = 120000; // 2 minutes max (fail fast)

export const maxDuration = 60; // 1 minute Vercel timeout (reduced from 5)
export const dynamic = 'force-dynamic';

/**
 * Get today's date string for tracking daily limits
 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Check if AI processing is disabled via kill switch
 */
function isAIDisabled(): boolean {
  return process.env.DISABLE_CRON_AI === 'true';
}

/**
 * Get Supabase client for tracking daily usage
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(url, key);
}

/**
 * Get the number of cafes already processed today
 */
async function getDailyProcessedCount(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Count submissions processed today (approved or rejected)
    const { count, error } = await supabase
      .from('user_submitted_cafes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['approved', 'rejected'])
      .gte('reviewed_at', todayStart.toISOString());

    if (error) {
      console.error('[CRON] Error checking daily count:', error);
      return MAX_DAILY_CAFES; // Fail safe: assume limit reached
    }

    return count || 0;
  } catch (error) {
    console.error('[CRON] Failed to check daily limit:', error);
    return MAX_DAILY_CAFES; // Fail safe: assume limit reached
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // ========================================================================
  // SAFEGUARD 1: Kill switch - disable AI processing entirely
  // ========================================================================
  if (isAIDisabled()) {
    console.log('[CRON] AI processing is DISABLED via DISABLE_CRON_AI');
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'AI processing disabled via kill switch',
      timestamp,
    });
  }

  // ========================================================================
  // SAFEGUARD 2: Verify cron secret
  // ========================================================================
  const authHeader = req.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('[CRON] CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron not configured', timestamp },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    console.warn('[CRON] Unauthorized cron request attempt');
    return NextResponse.json(
      { error: 'Unauthorized', timestamp },
      { status: 401 }
    );
  }

  // ========================================================================
  // SAFEGUARD 3: Check daily limit before making any AI calls
  // ========================================================================
  const alreadyProcessed = await getDailyProcessedCount();
  const remainingQuota = Math.max(0, MAX_DAILY_CAFES - alreadyProcessed);

  console.log(`[CRON] Daily quota: ${alreadyProcessed}/${MAX_DAILY_CAFES} used, ${remainingQuota} remaining`);

  if (remainingQuota === 0) {
    console.log('[CRON] Daily limit reached. Skipping processing.');
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: `Daily limit of ${MAX_DAILY_CAFES} cafes already reached`,
      alreadyProcessed,
      maxDaily: MAX_DAILY_CAFES,
      timestamp,
    });
  }

  // ========================================================================
  // SAFEGUARD 4: Process only remaining quota (max 5 per day)
  // ========================================================================
  console.log(`[CRON] Starting processing. Limit: ${remainingQuota} cafes`);

  try {
    // Set a timeout to prevent runaway costs
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${MAX_EXECUTION_TIME_MS}ms`));
      }, MAX_EXECUTION_TIME_MS);
    });

    // Run the agent with strict limit
    const agentPromise = runCafeApproverAgent({
      limit: remainingQuota, // Only process up to remaining daily quota
      verbose: false,
    });

    // Race between completion and timeout
    const summary = await Promise.race([agentPromise, timeoutPromise]);

    const executionTime = Date.now() - startTime;

    const response = {
      success: true,
      timestamp,
      executionTimeMs: executionTime,
      dailyQuota: {
        limit: MAX_DAILY_CAFES,
        previouslyUsed: alreadyProcessed,
        processedNow: summary.totalProcessed,
        remaining: Math.max(0, remainingQuota - summary.totalProcessed),
      },
      summary: {
        totalProcessed: summary.totalProcessed,
        approved: summary.approved,
        rejected: summary.rejected,
        flagged: summary.flagged,
        errors: summary.errors,
        claudeApiCalls: summary.claudeApiCalls,
      },
    };

    console.log(`[CRON] Completed in ${executionTime}ms`);
    console.log(`[CRON] Processed: ${summary.totalProcessed} cafes`);
    console.log(`[CRON] Results: ${summary.approved} approved, ${summary.rejected} rejected, ${summary.flagged} flagged`);
    console.log(`[CRON] API calls made: ${summary.claudeApiCalls}`);

    return NextResponse.json(response);

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[CRON] Error processing submissions:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        executionTimeMs: executionTime,
        dailyQuota: {
          limit: MAX_DAILY_CAFES,
          previouslyUsed: alreadyProcessed,
        },
      },
      { status: 500 }
    );
  }
}
