ALTER TABLE tenants ADD COLUMN company_website TEXT;
ALTER TABLE tenants ADD COLUMN proposal_license_info TEXT;
ALTER TABLE tenants ADD COLUMN proposal_default_terms TEXT;
ALTER TABLE tenants ADD COLUMN proposal_default_acknowledgment TEXT;

ALTER TABLE estimates ADD COLUMN proposal_title TEXT;
ALTER TABLE estimates ADD COLUMN payment_schedule TEXT;
ALTER TABLE estimates ADD COLUMN custom_terms TEXT;
