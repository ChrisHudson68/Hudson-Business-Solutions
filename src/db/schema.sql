CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    logo_path TEXT,
    invoice_prefix TEXT,
    company_email TEXT,
    company_phone TEXT,
    company_address TEXT,
    company_website TEXT,
    proposal_license_info TEXT,
    proposal_default_terms TEXT,
    proposal_default_acknowledgment TEXT,
    default_tax_rate REAL DEFAULT 0,
    default_labor_rate REAL DEFAULT 0,
    billing_exempt INTEGER NOT NULL DEFAULT 0,
    billing_status TEXT NOT NULL DEFAULT 'trialing',
    billing_plan TEXT,
    billing_trial_ends_at TEXT,
    billing_grace_ends_at TEXT,
    billing_customer_id TEXT,
    billing_subscription_id TEXT,
    billing_subscription_status TEXT,
    billing_updated_at TEXT,
    billing_state TEXT NOT NULL DEFAULT 'trialing',
    billing_grace_until TEXT,
    billing_override_reason TEXT,
    billing_overridden_by_user_id INTEGER,
    billing_overridden_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Employee',
    active INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL,
    employee_id INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email_unique
ON users (tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_users_employee_id
ON users (employee_id);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT,
    client_name TEXT,
    contract_amount REAL,
    retainage_percent REAL,
    start_date TEXT,
    status TEXT,
    tenant_id INTEGER,
    job_code TEXT,
    job_description TEXT,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id
ON jobs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status
ON jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_archived_at
ON jobs (tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_jobs_archived_by_user_id
ON jobs (archived_by_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_tenant_job_code_unique
ON jobs (tenant_id, job_code)
WHERE job_code IS NOT NULL AND TRIM(job_code) != '';

CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    amount REAL,
    date TEXT,
    description TEXT,
    tenant_id INTEGER,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_income_job_id
ON income(job_id);

CREATE INDEX IF NOT EXISTS idx_income_tenant_id
ON income(tenant_id);

CREATE INDEX IF NOT EXISTS idx_income_tenant_job_id
ON income(tenant_id, job_id);

CREATE INDEX IF NOT EXISTS idx_income_tenant_archived_at
ON income(tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_income_archived_by_user_id
ON income(archived_by_user_id);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    category TEXT,
    vendor TEXT,
    amount REAL,
    date TEXT,
    receipt_filename TEXT,
    tenant_id INTEGER,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_job_id
ON expenses(job_id);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id
ON expenses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_job_id
ON expenses(tenant_id, job_id);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_archived_at
ON expenses(tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_expenses_archived_by_user_id
ON expenses(archived_by_user_id);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pay_type TEXT NOT NULL,
    hourly_rate REAL,
    annual_salary REAL,
    active INTEGER NOT NULL DEFAULT 1,
    lunch_deduction_exempt INTEGER NOT NULL DEFAULT 0,
    tenant_id INTEGER,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_employees_tenant_id
ON employees(tenant_id);

CREATE INDEX IF NOT EXISTS idx_employees_tenant_archived_at
ON employees (tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_employees_archived_by_user_id
ON employees (archived_by_user_id);

CREATE TABLE IF NOT EXISTS time_entries (
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

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_clock_out
ON time_entries(employee_id, clock_out_at, tenant_id);

CREATE TABLE IF NOT EXISTS time_entry_edit_requests (
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

CREATE INDEX IF NOT EXISTS idx_time_entry_edit_requests_status
ON time_entry_edit_requests(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    invoice_number TEXT,
    date_issued TEXT NOT NULL,
    due_date TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Unpaid',
    notes TEXT,
    attachment_filename TEXT,
    tenant_id INTEGER,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_job_id
ON invoices(job_id);

CREATE INDEX IF NOT EXISTS idx_invoices_status
ON invoices(status);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id
ON invoices(tenant_id);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_job_id
ON invoices(tenant_id, job_id);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_archived_at
ON invoices (tenant_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_invoices_archived_by_user_id
ON invoices (archived_by_user_id);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    method TEXT,
    reference TEXT,
    tenant_id INTEGER,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id
ON payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id
ON payments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_invoice_id
ON payments(tenant_id, invoice_id);

CREATE TABLE IF NOT EXISTS estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    estimate_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    site_address TEXT,
    scope_of_work TEXT,
    proposal_title TEXT,
    payment_schedule TEXT,
    custom_terms TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by_user_id INTEGER NOT NULL,
    updated_by_user_id INTEGER,
    sent_at TEXT,
    responded_at TEXT,
    approval_notes TEXT,
    rejection_reason TEXT,
    converted_job_id INTEGER,
    expiration_date TEXT,
    public_token TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id),
    FOREIGN KEY(updated_by_user_id) REFERENCES users(id),
    FOREIGN KEY(converted_job_id) REFERENCES jobs(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_tenant_estimate_number_unique
ON estimates (tenant_id, estimate_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_public_token_unique
ON estimates (public_token)
WHERE public_token IS NOT NULL AND TRIM(public_token) != '';

CREATE INDEX IF NOT EXISTS idx_estimates_tenant_status
ON estimates (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimates_tenant_customer_name
ON estimates (tenant_id, customer_name);

CREATE INDEX IF NOT EXISTS idx_estimates_tenant_created_by
ON estimates (tenant_id, created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_estimates_converted_job_id
ON estimates (converted_job_id);

CREATE TABLE IF NOT EXISTS estimate_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT,
    unit_cost REAL NOT NULL DEFAULT 0,
    upcharge_percent REAL NOT NULL DEFAULT 0,
    apply_upcharge INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate_sort
ON estimate_line_items (estimate_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_estimate_line_items_tenant_estimate
ON estimate_line_items (tenant_id, estimate_id);

CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    actor_user_id INTEGER,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    description TEXT NOT NULL,
    metadata_json TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(actor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created_at
ON activity_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_event_type
ON activity_logs (tenant_id, event_type);

CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_actor
ON activity_logs (tenant_id, actor_user_id);

CREATE TABLE IF NOT EXISTS migration_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_billing_status
ON tenants(billing_status);

CREATE INDEX IF NOT EXISTS idx_tenants_billing_exempt
ON tenants(billing_exempt);

CREATE INDEX IF NOT EXISTS idx_tenants_billing_state
ON tenants(billing_state);