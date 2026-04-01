CREATE TABLE IF NOT EXISTS monthly_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  vendor TEXT,
  amount REAL NOT NULL,
  due_day INTEGER NOT NULL DEFAULT 1,
  effective_start_date TEXT NOT NULL,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  archived_at TEXT,
  archived_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (archived_by_user_id) REFERENCES users(id),
  CHECK (due_day >= 1 AND due_day <= 31)
);

CREATE INDEX IF NOT EXISTS idx_monthly_bills_tenant_active_archived
  ON monthly_bills (tenant_id, active, archived_at);

CREATE INDEX IF NOT EXISTS idx_monthly_bills_tenant_due_day
  ON monthly_bills (tenant_id, due_day);
