ALTER TABLE users ADD COLUMN employee_id INTEGER;

ALTER TABLE time_entries ADD COLUMN clock_in_at TEXT;
ALTER TABLE time_entries ADD COLUMN clock_out_at TEXT;
ALTER TABLE time_entries ADD COLUMN entry_method TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE time_entries ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE time_entries ADD COLUMN approved_by_user_id INTEGER;
ALTER TABLE time_entries ADD COLUMN approved_at TEXT;
ALTER TABLE time_entries ADD COLUMN last_edited_by_user_id INTEGER;
ALTER TABLE time_entries ADD COLUMN last_edited_at TEXT;
ALTER TABLE time_entries ADD COLUMN edit_reason TEXT;

CREATE TABLE IF NOT EXISTS time_entry_edit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    time_entry_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    requested_by_user_id INTEGER NOT NULL,
    proposed_job_id INTEGER NOT NULL,
    proposed_date TEXT NOT NULL,
    proposed_clock_in_at TEXT NOT NULL,
    proposed_clock_out_at TEXT NOT NULL,
    proposed_hours REAL NOT NULL,
    proposed_note TEXT,
    request_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by_user_id INTEGER,
    reviewed_at TEXT,
    review_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(time_entry_id) REFERENCES time_entries(id),
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(requested_by_user_id) REFERENCES users(id),
    FOREIGN KEY(reviewed_by_user_id) REFERENCES users(id),
    FOREIGN KEY(proposed_job_id) REFERENCES jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_users_employee_id
ON users(employee_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_clock_out
ON time_entries(employee_id, clock_out_at, tenant_id);

CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_status
ON time_entry_edit_requests(tenant_id, status, created_at);