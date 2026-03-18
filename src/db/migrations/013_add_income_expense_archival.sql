ALTER TABLE income ADD COLUMN archived_at TEXT;
ALTER TABLE income ADD COLUMN archived_by_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_income_tenant_archived_at
ON income (tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_income_archived_by_user_id
ON income (archived_by_user_id);

ALTER TABLE expenses ADD COLUMN archived_at TEXT;
ALTER TABLE expenses ADD COLUMN archived_by_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_archived_at
ON expenses (tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_expenses_archived_by_user_id
ON expenses (archived_by_user_id);
