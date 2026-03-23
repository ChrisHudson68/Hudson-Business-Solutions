ALTER TABLE estimates ADD COLUMN archived_at TEXT;
ALTER TABLE estimates ADD COLUMN archived_by_user_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_estimates_tenant_archived
ON estimates (tenant_id, archived_at, updated_at DESC);
