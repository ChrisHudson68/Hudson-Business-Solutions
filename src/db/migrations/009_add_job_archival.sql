ALTER TABLE jobs ADD COLUMN archived_at TEXT;
ALTER TABLE jobs ADD COLUMN archived_by_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_archived_at
ON jobs (tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_jobs_archived_by_user_id
ON jobs (archived_by_user_id);