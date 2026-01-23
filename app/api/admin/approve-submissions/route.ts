import { NextRequest, NextResponse } from 'next/server';
import { runCafeApproverAgent, fetchPendingSubmissions } from '@/lib/agents/cafeApprover';

/**
 * POST /api/admin/approve-submissions
 * Trigger the cafe approver agent to process pending submissions
 *
 * Body:
 * - dryRun: boolean (optional) - If true, don't make DB changes
 * - limit: number (optional) - Max submissions to process
 *
 * NOTE: In production, add authentication/authorization to this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = false, limit = 10 } = body;

    console.log(`[API] Running cafe approver agent (dryRun: ${dryRun}, limit: ${limit})`);

    const summary = await runCafeApproverAgent({
      dryRun,
      limit,
      verbose: true,
    });

    return NextResponse.json({
      success: true,
      message: `Processed ${summary.totalProcessed} submission(s)`,
      summary: {
        totalProcessed: summary.totalProcessed,
        approved: summary.approved,
        rejected: summary.rejected,
        flagged: summary.flagged,
        errors: summary.errors,
        claudeApiCalls: summary.claudeApiCalls,
        durationMs: summary.completedAt.getTime() - summary.startedAt.getTime(),
      },
      results: summary.results.map((r) => ({
        submissionId: r.submissionId,
        action: r.action,
        cafeId: r.cafeId,
        notes: r.notes,
        nameMatchScore: r.nameMatchScore,
        distanceMeters: r.distanceMeters,
        usedClaude: r.usedClaude,
      })),
    });
  } catch (error) {
    console.error('[API] Error running cafe approver:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/approve-submissions
 * List pending submissions for dashboard review
 *
 * Query params:
 * - limit: number (optional) - Max submissions to return (default: 50)
 * - status: string (optional) - Filter by status (pending, approved, rejected)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status') || 'pending';

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // For pending, use the agent's fetch function
    if (status === 'pending') {
      const submissions = await fetchPendingSubmissions(limit);
      return NextResponse.json({
        success: true,
        count: submissions.length,
        submissions: submissions.map((s) => ({
          id: s.id,
          name: s.name,
          googleMapsLink: s.google_maps_link,
          status: s.status,
          submittedAt: s.created_at,
          reviewNotes: s.review_notes,
        })),
      });
    }

    // For other statuses, fetch directly
    const { supabaseAdmin } = await import('@/lib/supabase-server');
    const { data, error } = await supabaseAdmin
      .from('user_submitted_cafes')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      submissions: (data || []).map((s) => ({
        id: s.id,
        name: s.name,
        googleMapsLink: s.google_maps_link,
        status: s.status,
        submittedAt: s.created_at,
        reviewedAt: s.reviewed_at,
        reviewNotes: s.review_notes,
        approvedCafeId: s.approved_cafe_id,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching submissions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
