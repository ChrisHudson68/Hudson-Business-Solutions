ALTER TABLE tenants ADD COLUMN billing_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN billing_status TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE tenants ADD COLUMN billing_plan TEXT;
ALTER TABLE tenants ADD COLUMN billing_trial_ends_at TEXT;
ALTER TABLE tenants ADD COLUMN billing_grace_ends_at TEXT;
ALTER TABLE tenants ADD COLUMN billing_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN billing_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN billing_subscription_status TEXT;
ALTER TABLE tenants ADD COLUMN billing_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_billing_status ON tenants(billing_status);
CREATE INDEX IF NOT EXISTS idx_tenants_billing_exempt ON tenants(billing_exempt);
