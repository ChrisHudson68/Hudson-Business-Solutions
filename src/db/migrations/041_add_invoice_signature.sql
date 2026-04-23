ALTER TABLE invoices ADD COLUMN public_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices(public_token) WHERE public_token IS NOT NULL;
ALTER TABLE invoices ADD COLUMN sent_for_signature_at TEXT;
ALTER TABLE invoices ADD COLUMN signature_data TEXT;
ALTER TABLE invoices ADD COLUMN signer_name TEXT;
ALTER TABLE invoices ADD COLUMN signature_ip TEXT;
ALTER TABLE invoices ADD COLUMN signed_at TEXT;
