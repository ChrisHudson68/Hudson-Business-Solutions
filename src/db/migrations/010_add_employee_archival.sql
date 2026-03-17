ALTER TABLE employees ADD COLUMN archived_at TEXT;
ALTER TABLE employees ADD COLUMN archived_by_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_employees_tenant_archived_at
ON employees (tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_employees_archived_by_user_id
ON employees (archived_by_user_id);