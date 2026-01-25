/**
 * Cron endpoint for automated cafe submission processing
 *
 * This endpoint is triggered by Vercel Cron to periodically process
 * pending cafe submissions using the cafe approver agent.
 *
 * Security: Requires CRON_SECRET in Authorization header
 * Frequency: Configured in vercel.json (default: every 2 hours)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runCafeApproverAgent } from '@/lib/agents/cafeApprover';

export const maxDuration = 300; // 5 minutes max execution time
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) {
    console.error('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron not configured' },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    console.warn('Unauthorized cron request attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[CRON] Starting automated submission processing...');

  try {
    // Process submissions in batches until queue is empty or we hit limits
    const results = [];
    let totalProcessed = 0;
    let hasMore = true;
    const maxRuns = 5; // Safety limit: max 5 batches per cron run
    const batchSize = 20;

    while (hasMore && results.length < maxRuns) {
      const summary = await runCafeApproverAgent({
        limit: batchSize,
        verbose: false, // Reduce logging in production
      });

      results.push(summary);
      totalProcessed += summary.totalProcessed;

      // If we processed fewer than the batch size, we're done
      hasMore = summary.totalProcessed === batchSize;

      if (hasMore) {
        // Brief pause between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      totalProcessed,
      batchRuns: results.length,
      summary: {
        approved: results.reduce((sum, r) => sum + r.approved, 0),
        rejected: results.reduce((sum, r) => sum + r.rejected, 0),
        flagged: results.reduce((sum, r) => sum + r.flagged, 0),
        errors: results.reduce((sum, r) => sum + r.errors, 0),
        claudeApiCalls: results.reduce((sum, r) => sum + r.claudeApiCalls, 0),
      },
      batches: results,
    };

    console.log(`[CRON] Completed: ${totalProcessed} submissions processed in ${results.length} batch(es)`);
    console.log(`[CRON] Results: ${response.summary.approved} approved, ${response.summary.rejected} rejected, ${response.summary.flagged} flagged`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[CRON] Error processing submissions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
