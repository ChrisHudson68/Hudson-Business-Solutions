CREATE TABLE IF NOT EXISTS fleet_vehicle_assignment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  previous_employee_id INTEGER,
  new_employee_id INTEGER,
  previous_driver_name TEXT,
  new_driver_name TEXT,
  note TEXT,
  changed_by_user_id INTEGER,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (previous_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (new_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fleet_assignment_history_tenant_vehicle
  ON fleet_vehicle_assignment_history (tenant_id, vehicle_id, changed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_assignment_history_tenant_changed_at
  ON fleet_vehicle_assignment_history (tenant_id, changed_at DESC, id DESC);