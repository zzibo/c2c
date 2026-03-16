-- ============================================================================
-- CRON JOB LOGGING TABLE
-- ============================================================================
-- Tracks every cron run (success, error, or skipped) so the operator can
-- verify the job is firing and inspect results via Supabase dashboard.
-- ============================================================================

CREATE TYPE cron_run_status AS ENUM ('success', 'error', 'skipped');

CREATE TABLE cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status cron_run_status NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER,
  cafes_processed INTEGER NOT NULL DEFAULT 0,
  cafes_approved INTEGER NOT NULL DEFAULT 0,
  cafes_rejected INTEGER NOT NULL DEFAULT 0,
  cafes_flagged INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  claude_api_calls INTEGER NOT NULL DEFAULT 0,
  skip_reason TEXT,
  error_message TEXT,
  daily_quota_used INTEGER,
  daily_quota_limit INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cron_logs_started_at ON cron_logs(started_at DESC);
CREATE INDEX idx_cron_logs_status ON cron_logs(status);
