PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

CREATE TABLE time_entries_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    hours REAL NOT NULL DEFAULT 0,
    note TEXT,
    labor_cost REAL NOT NULL DEFAULT 0,
    tenant_id INTEGER NOT NULL,
    clock_in_at TEXT,
    clock_out_at TEXT,
    entry_method TEXT NOT NULL DEFAULT 'manual',
    approval_status TEXT NOT NULL DEFAULT 'approved',
    approved_by_user_id INTEGER,
    approved_at TEXT,
    last_edited_by_user_id INTEGER,
    last_edited_at TEXT,
    edit_reason TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(approved_by_user_id) REFERENCES users(id),
    FOREIGN KEY(last_edited_by_user_id) REFERENCES users(id)
);

INSERT INTO time_entries_new (
    id,
    job_id,
    employee_id,
    date,
    hours,
    note,
    labor_cost,
    tenant_id,
    clock_in_at,
    clock_out_at,
    entry_method,
    approval_status,
    approved_by_user_id,
    approved_at,
    last_edited_by_user_id,
    last_edited_at,
    edit_reason
)
SELECT
    id,
    job_id,
    employee_id,
    date,
    hours,
    note,
    labor_cost,
    tenant_id,
    clock_in_at,
    clock_out_at,
    entry_method,
    approval_status,
    approved_by_user_id,
    approved_at,
    last_edited_by_user_id,
    last_edited_at,
    edit_reason
FROM time_entries;

DROP TABLE time_entries;
ALTER TABLE time_entries_new RENAME TO time_entries;

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_clock_out
ON time_entries(employee_id, clock_out_at, tenant_id);

CREATE TABLE time_entry_edit_requests_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    time_entry_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    requested_by_user_id INTEGER NOT NULL,
    proposed_job_id INTEGER,
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

INSERT INTO time_entry_edit_requests_new (
    id,
    tenant_id,
    time_entry_id,
    employee_id,
    requested_by_user_id,
    proposed_job_id,
    proposed_date,
    proposed_clock_in_at,
    proposed_clock_out_at,
    proposed_hours,
    proposed_note,
    request_reason,
    status,
    reviewed_by_user_id,
    reviewed_at,
    review_note,
    created_at
)
SELECT
    id,
    tenant_id,
    time_entry_id,
    employee_id,
    requested_by_user_id,
    proposed_job_id,
    proposed_date,
    proposed_clock_in_at,
    proposed_clock_out_at,
    proposed_hours,
    proposed_note,
    request_reason,
    status,
    reviewed_by_user_id,
    reviewed_at,
    review_note,
    created_at
FROM time_entry_edit_requests;

DROP TABLE time_entry_edit_requests;
ALTER TABLE time_entry_edit_requests_new RENAME TO time_entry_edit_requests;

CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_status
ON time_entry_edit_requests(tenant_id, status, created_at);

COMMIT;

PRAGMA foreign_keys=ON;