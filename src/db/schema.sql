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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Employee',
    active INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT,
    client_name TEXT,
    contract_amount REAL,
    retainage_percent REAL,
    start_date TEXT,
    status TEXT,
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
    category TEXT,
    vendor TEXT,
    amount REAL,
    date TEXT,
    receipt_filename TEXT,
    tenant_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pay_type TEXT NOT NULL,
    hourly_rate REAL,
    annual_salary REAL,
    active INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    hours REAL NOT NULL,
    note TEXT,
    labor_cost REAL NOT NULL DEFAULT 0,
    tenant_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    invoice_number TEXT,
    date_issued TEXT NOT NULL,
    due_date TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Unpaid',
    notes TEXT,
    tenant_id INTEGER,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);

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

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_income_tenant_id ON income(tenant_id);
CREATE INDEX IF NOT EXISTS idx_income_tenant_job_id ON income(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_income_job_id ON income(job_id);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_job_id ON expenses(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_expenses_job_id ON expenses(job_id);

CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_id ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_job_id ON time_entries(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_employee_id ON time_entries(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_job_id ON invoices(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_invoice_id ON payments(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_tenants_billing_status ON tenants(billing_status);
CREATE INDEX IF NOT EXISTS idx_tenants_billing_exempt ON tenants(billing_exempt);
