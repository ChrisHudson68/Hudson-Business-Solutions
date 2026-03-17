ALTER TABLE invoices ADD COLUMN archived_at TEXT;
ALTER TABLE invoices ADD COLUMN archived_by_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_archived_at
ON invoices (tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_invoices_archived_by_user_id
ON invoices (archived_by_user_id);