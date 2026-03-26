ALTER TABLE invoices ADD COLUMN customer_name TEXT;
ALTER TABLE invoices ADD COLUMN customer_email TEXT;
ALTER TABLE invoices ADD COLUMN customer_phone TEXT;
ALTER TABLE invoices ADD COLUMN customer_address TEXT;

ALTER TABLE invoices ADD COLUMN company_name_snapshot TEXT;
ALTER TABLE invoices ADD COLUMN company_email_snapshot TEXT;
ALTER TABLE invoices ADD COLUMN company_phone_snapshot TEXT;
ALTER TABLE invoices ADD COLUMN company_address_snapshot TEXT;
ALTER TABLE invoices ADD COLUMN company_website_snapshot TEXT;
ALTER TABLE invoices ADD COLUMN company_logo_path_snapshot TEXT;

ALTER TABLE invoices ADD COLUMN job_name_snapshot TEXT;
ALTER TABLE invoices ADD COLUMN job_code_snapshot TEXT;

ALTER TABLE invoices ADD COLUMN subtotal_amount REAL;
ALTER TABLE invoices ADD COLUMN discount_type TEXT;
ALTER TABLE invoices ADD COLUMN discount_value REAL;
ALTER TABLE invoices ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN tax_rate REAL;
ALTER TABLE invoices ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN total_amount REAL;

ALTER TABLE invoices ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE invoices ADD COLUMN terms_text TEXT;
ALTER TABLE invoices ADD COLUMN public_notes TEXT;
ALTER TABLE invoices ADD COLUMN internal_notes TEXT;

ALTER TABLE invoices ADD COLUMN sent_at TEXT;
ALTER TABLE invoices ADD COLUMN viewed_at TEXT;
ALTER TABLE invoices ADD COLUMN paid_at TEXT;
ALTER TABLE invoices ADD COLUMN voided_at TEXT;
ALTER TABLE invoices ADD COLUMN void_reason TEXT;

ALTER TABLE invoices ADD COLUMN created_by_user_id INTEGER;
ALTER TABLE invoices ADD COLUMN sent_by_user_id INTEGER;
ALTER TABLE invoices ADD COLUMN voided_by_user_id INTEGER;

ALTER TABLE invoices ADD COLUMN pdf_generated_at TEXT;
ALTER TABLE invoices ADD COLUMN pdf_file_path TEXT;
ALTER TABLE invoices ADD COLUMN pdf_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE invoices ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN locked_at TEXT;
ALTER TABLE invoices ADD COLUMN lock_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_invoice_number_unique
ON invoices (tenant_id, invoice_number)
WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != '';

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status_due_date
ON invoices (tenant_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_sent_at
ON invoices (tenant_id, sent_at);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT,
    unit_price REAL NOT NULL DEFAULT 0,
    line_subtotal REAL NOT NULL DEFAULT 0,
    line_discount_type TEXT,
    line_discount_value REAL,
    line_discount_amount REAL NOT NULL DEFAULT 0,
    tax_rate REAL,
    tax_amount REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    source_type TEXT,
    source_id INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_sort
ON invoice_line_items (invoice_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_tenant_invoice
ON invoice_line_items (tenant_id, invoice_id);

CREATE TABLE IF NOT EXISTS invoice_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    tenant_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_description TEXT,
    event_payload_json TEXT,
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice_created_at
ON invoice_events (invoice_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_events_tenant_invoice
ON invoice_events (tenant_id, invoice_id);

ALTER TABLE payments ADD COLUMN notes TEXT;
ALTER TABLE payments ADD COLUMN created_by_user_id INTEGER;
ALTER TABLE payments ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payments ADD COLUMN payment_reference_type TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_tenant_date
ON payments (tenant_id, date DESC, id DESC);

UPDATE invoices
SET subtotal_amount = COALESCE(subtotal_amount, amount),
    discount_amount = COALESCE(discount_amount, 0),
    tax_amount = COALESCE(tax_amount, 0),
    total_amount = COALESCE(total_amount, amount),
    public_notes = COALESCE(public_notes, notes)
WHERE 1 = 1;

UPDATE invoices
SET customer_name = COALESCE(customer_name, NULLIF(TRIM((
      SELECT j.client_name
      FROM jobs j
      WHERE j.id = invoices.job_id
        AND j.tenant_id = invoices.tenant_id
      LIMIT 1
    )), '')),
    job_name_snapshot = COALESCE(job_name_snapshot, NULLIF(TRIM((
      SELECT j.job_name
      FROM jobs j
      WHERE j.id = invoices.job_id
        AND j.tenant_id = invoices.tenant_id
      LIMIT 1
    )), '')),
    job_code_snapshot = COALESCE(job_code_snapshot, NULLIF(TRIM((
      SELECT j.job_code
      FROM jobs j
      WHERE j.id = invoices.job_id
        AND j.tenant_id = invoices.tenant_id
      LIMIT 1
    )), ''))
WHERE 1 = 1;

UPDATE invoices
SET company_name_snapshot = COALESCE(company_name_snapshot, NULLIF(TRIM((
      SELECT t.name
      FROM tenants t
      WHERE t.id = invoices.tenant_id
      LIMIT 1
    )), '')),
    company_email_snapshot = COALESCE(company_email_snapshot, NULLIF(TRIM((
      SELECT t.company_email
      FROM tenants t
      WHERE t.id = invoices.tenant_id
      LIMIT 1
    )), '')),
    company_phone_snapshot = COALESCE(company_phone_snapshot, NULLIF(TRIM((
      SELECT t.company_phone
      FROM tenants t
      WHERE t.id = invoices.tenant_id
      LIMIT 1
    )), '')),
    company_address_snapshot = COALESCE(company_address_snapshot, NULLIF(TRIM((
      SELECT t.company_address
      FROM tenants t
      WHERE t.id = invoices.tenant_id
      LIMIT 1
    )), '')),
    company_logo_path_snapshot = COALESCE(company_logo_path_snapshot, NULLIF(TRIM((
      SELECT t.logo_path
      FROM tenants t
      WHERE t.id = invoices.tenant_id
      LIMIT 1
    )), ''))
WHERE 1 = 1;

INSERT INTO invoice_line_items (
    invoice_id,
    tenant_id,
    description,
    quantity,
    unit,
    unit_price,
    line_subtotal,
    line_discount_amount,
    tax_amount,
    line_total,
    sort_order
)
SELECT
    i.id,
    i.tenant_id,
    CASE
      WHEN i.notes IS NOT NULL AND TRIM(i.notes) != '' THEN 'Legacy invoice amount - ' || substr(replace(replace(i.notes, char(13), ' '), char(10), ' '), 1, 100)
      ELSE 'Legacy invoice amount'
    END,
    1,
    NULL,
    COALESCE(i.total_amount, i.amount, 0),
    COALESCE(i.subtotal_amount, i.amount, 0),
    COALESCE(i.discount_amount, 0),
    COALESCE(i.tax_amount, 0),
    COALESCE(i.total_amount, i.amount, 0),
    0
FROM invoices i
WHERE NOT EXISTS (
    SELECT 1
    FROM invoice_line_items li
    WHERE li.invoice_id = i.id
);
