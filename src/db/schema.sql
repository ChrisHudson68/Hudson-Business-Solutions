CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subdomain TEXT NOT NULL UNIQUE,
    logo_path TEXT,
    invoice_prefix TEXT,
    company_email TEXT,
    company_phone TEXT,
    company_address TEXT,
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
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email_unique
ON users (tenant_id, email);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT,
    client_name TEXT,
    contract_amount REAL,
    retainage_percent REAL,
    start_date TEXT,
    status TEXT,
    job_code TEXT,
    tenant_id INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    amount REAL,
    date TEXT,
    description TEXT,
    tenant_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    amount REAL,
    date TEXT,
    category TEXT,
    description TEXT,
    receipt_path TEXT,
    tenant_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    role TEXT,
    hourly_rate REAL,
    tenant_id INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    job_id INTEGER,
    date TEXT,
    hours REAL,
    tenant_id INTEGER,
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    invoice_number TEXT,
    invoice_date TEXT,
    due_date TEXT,
    amount REAL,
    status TEXT,
    notes TEXT,
    tenant_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    amount REAL,
    payment_date TEXT,
    method TEXT,
    reference TEXT,
    notes TEXT,
    tenant_id INTEGER,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);