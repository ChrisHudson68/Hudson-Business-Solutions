PRAGMA foreign_keys = ON;

ALTER TABLE tenants ADD COLUMN fleet_oil_change_miles INTEGER NOT NULL DEFAULT 5000;
ALTER TABLE tenants ADD COLUMN fleet_oil_change_days INTEGER NOT NULL DEFAULT 180;
ALTER TABLE tenants ADD COLUMN fleet_tire_rotation_miles INTEGER NOT NULL DEFAULT 6000;
ALTER TABLE tenants ADD COLUMN fleet_tire_rotation_days INTEGER NOT NULL DEFAULT 180;
ALTER TABLE tenants ADD COLUMN fleet_inspection_days INTEGER NOT NULL DEFAULT 365;

ALTER TABLE fleet_entries ADD COLUMN maintenance_category TEXT;

UPDATE fleet_entries
SET maintenance_category = CASE
  WHEN entry_type <> 'maintenance' THEN NULL
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%oil%' THEN 'oil_change'
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%tire%' AND LOWER(COALESCE(service_type, '')) LIKE '%rotation%' THEN 'tire_rotation'
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%inspection%' THEN 'inspection'
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%brake%' THEN 'brakes'
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%transmission%' THEN 'transmission'
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%cool%' OR LOWER(COALESCE(service_type, '')) LIKE '%radiator%' THEN 'cooling'
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%electrical%' OR LOWER(COALESCE(service_type, '')) LIKE '%battery%' THEN 'electrical'
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%engine%' THEN 'engine'
  WHEN LOWER(COALESCE(service_type, '')) LIKE '%tire%' THEN 'tires'
  ELSE 'other'
END
WHERE entry_type = 'maintenance' AND maintenance_category IS NULL;

CREATE INDEX IF NOT EXISTS idx_fleet_entries_tenant_vehicle_date
  ON fleet_entries (tenant_id, vehicle_id, entry_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_entries_tenant_category_date
  ON fleet_entries (tenant_id, maintenance_category, entry_date DESC, id DESC);
