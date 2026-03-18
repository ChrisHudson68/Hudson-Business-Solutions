ALTER TABLE tenants ADD COLUMN billing_state TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE tenants ADD COLUMN billing_grace_until TEXT NULL;
ALTER TABLE tenants ADD COLUMN billing_override_reason TEXT NULL;
ALTER TABLE tenants ADD COLUMN billing_overridden_by_user_id INTEGER NULL;
ALTER TABLE tenants ADD COLUMN billing_overridden_at TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_billing_state
ON tenants(billing_state);