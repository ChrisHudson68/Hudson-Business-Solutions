CREATE TABLE IF NOT EXISTS receipt_parsing_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    expense_id INTEGER,
    receipt_filename TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    raw_text TEXT,
    parsed_json TEXT,
    confidence_json TEXT,
    error_message TEXT,
    ocr_engine TEXT,
    processed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_parsing_results_tenant_receipt
ON receipt_parsing_results(tenant_id, receipt_filename);

CREATE INDEX IF NOT EXISTS idx_receipt_parsing_results_expense_id
ON receipt_parsing_results(expense_id);

CREATE INDEX IF NOT EXISTS idx_receipt_parsing_results_tenant_status
ON receipt_parsing_results(tenant_id, status);
