PRAGMA foreign_keys=OFF;

BEGIN TRANSACTION;

CREATE TABLE invoices_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
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
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    company_name_snapshot TEXT,
    company_email_snapshot TEXT,
    company_phone_snapshot TEXT,
    company_address_snapshot TEXT,
    company_website_snapshot TEXT,
    company_logo_path_snapshot TEXT,
    job_name_snapshot TEXT,
    job_code_snapshot TEXT,
    subtotal_amount REAL,
    discount_type TEXT,
    discount_value REAL,
    discount_amount REAL NOT NULL DEFAULT 0,
    tax_rate REAL,
    tax_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    terms_text TEXT,
    public_notes TEXT,
    internal_notes TEXT,
    sent_at TEXT,
    viewed_at TEXT,
    paid_at TEXT,
    voided_at TEXT,
    void_reason TEXT,
    created_by_user_id INTEGER,
    sent_by_user_id INTEGER,
    voided_by_user_id INTEGER,
    pdf_generated_at TEXT,
    pdf_file_path TEXT,
    pdf_version INTEGER NOT NULL DEFAULT 1,
    version_number INTEGER NOT NULL DEFAULT 1,
    locked_at TEXT,
    lock_reason TEXT,
    public_token TEXT,
    sent_for_signature_at TEXT,
    signature_data TEXT,
    signer_name TEXT,
    signature_ip TEXT,
    signed_at TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id),
    FOREIGN KEY(tenant_id) REFERENCES tenants(id),
    FOREIGN KEY(archived_by_user_id) REFERENCES users(id)
);

INSERT INTO invoices_new (
    id, job_id, invoice_number, date_issued, due_date, amount, status,
    notes, attachment_filename, tenant_id, archived_at, archived_by_user_id,
    customer_name, customer_email, customer_phone, customer_address,
    company_name_snapshot, company_email_snapshot, company_phone_snapshot,
    company_address_snapshot, company_website_snapshot, company_logo_path_snapshot,
    job_name_snapshot, job_code_snapshot,
    subtotal_amount, discount_type, discount_value, discount_amount,
    tax_rate, tax_amount, total_amount, currency_code,
    terms_text, public_notes, internal_notes,
    sent_at, viewed_at, paid_at, voided_at, void_reason,
    created_by_user_id, sent_by_user_id, voided_by_user_id,
    pdf_generated_at, pdf_file_path, pdf_version,
    version_number, locked_at, lock_reason,
    public_token, sent_for_signature_at, signature_data,
    signer_name, signature_ip, signed_at
)
SELECT
    id, job_id, invoice_number, date_issued, due_date, amount, status,
    notes, attachment_filename, tenant_id, archived_at, archived_by_user_id,
    customer_name, customer_email, customer_phone, customer_address,
    company_name_snapshot, company_email_snapshot, company_phone_snapshot,
    company_address_snapshot, company_website_snapshot, company_logo_path_snapshot,
    job_name_snapshot, job_code_snapshot,
    subtotal_amount, discount_type, discount_value, discount_amount,
    tax_rate, tax_amount, total_amount, currency_code,
    terms_text, public_notes, internal_notes,
    sent_at, viewed_at, paid_at, voided_at, void_reason,
    created_by_user_id, sent_by_user_id, voided_by_user_id,
    pdf_generated_at, pdf_file_path, pdf_version,
    version_number, locked_at, lock_reason,
    public_token, sent_for_signature_at, signature_data,
    signer_name, signature_ip, signed_at
FROM invoices;

DROP TABLE invoices;
ALTER TABLE invoices_new RENAME TO invoices;

CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_job_id ON invoices(tenant_id, job_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_invoice_number_unique
  ON invoices(tenant_id, invoice_number)
  WHERE invoice_number IS NOT NULL AND TRIM(invoice_number) != '';
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status_due_date ON invoices(tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_sent_at ON invoices(tenant_id, sent_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices(public_token) WHERE public_token IS NOT NULL;

COMMIT;

PRAGMA foreign_keys=ON;
