CREATE TABLE IF NOT EXISTS time_entry_week_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    approved_by_user_id INTEGER NOT NULL,
    approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    UNIQUE(tenant_id, employee_id, week_start),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(approved_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_time_entry_week_approvals_lookup
ON time_entry_week_approvals(tenant_id, employee_id, week_start);
