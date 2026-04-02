PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fleet_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('registration', 'insurance', 'inspection', 'service_contract', 'other')),
  title TEXT NOT NULL,
  file_filename TEXT NOT NULL,
  original_filename TEXT,
  expiration_date TEXT,
  notes TEXT,
  archived_at TEXT,
  archived_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_fleet_documents_tenant_vehicle_archived
  ON fleet_documents (tenant_id, vehicle_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_fleet_documents_tenant_expiration
  ON fleet_documents (tenant_id, expiration_date);

CREATE INDEX IF NOT EXISTS idx_fleet_documents_tenant_type
  ON fleet_documents (tenant_id, document_type, archived_at);
