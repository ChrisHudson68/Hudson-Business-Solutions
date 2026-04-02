CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  unit_number TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,
  license_plate TEXT,
  vin TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  archived_at TEXT,
  archived_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_tenant_active_archived
  ON fleet_vehicles (tenant_id, active, archived_at);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_tenant_display_name
  ON fleet_vehicles (tenant_id, display_name);

CREATE TABLE IF NOT EXISTS fleet_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('fuel', 'maintenance')),
  entry_date TEXT NOT NULL,
  vendor TEXT,
  amount REAL NOT NULL,
  odometer INTEGER,
  gallons REAL,
  service_type TEXT,
  notes TEXT,
  receipt_filename TEXT,
  archived_at TEXT,
  archived_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_fleet_entries_tenant_vehicle_date
  ON fleet_entries (tenant_id, vehicle_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_entries_tenant_type_date
  ON fleet_entries (tenant_id, entry_type, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_entries_tenant_archived
  ON fleet_entries (tenant_id, archived_at);
