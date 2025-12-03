-- Create cron_job_logs table to track cron job executions
CREATE TABLE IF NOT EXISTS cron_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'success', 'error', 'warning'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER, -- Duration in milliseconds
  message TEXT,
  error_details TEXT, -- JSON or text details about errors
  execution_data JSONB, -- Additional data about the execution (counts, stats, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name ON cron_job_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_status ON cron_job_logs(status);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_started_at ON cron_job_logs(started_at DESC);

-- Add RLS policies (only superadmins can read)
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only superadmins can read cron job logs
CREATE POLICY "Only superadmins can read cron job logs"
  ON cron_job_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_status = 'superadmin'
    )
  );

-- Policy: System can insert cron job logs (no auth required for cron jobs)
CREATE POLICY "System can insert cron job logs"
  ON cron_job_logs
  FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE cron_job_logs IS 'Logs execution history for cron jobs including success/error status and execution details';

