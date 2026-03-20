CREATE TABLE IF NOT EXISTS estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    estimate_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    site_address TEXT,
    scope_of_work TEXT,
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