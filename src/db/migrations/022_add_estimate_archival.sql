ALTER TABLE estimates ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_estimates_tenant_archived_at
ON estimates (tenant_id, archived_at);
