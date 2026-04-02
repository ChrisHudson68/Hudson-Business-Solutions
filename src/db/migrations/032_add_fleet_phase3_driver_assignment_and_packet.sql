ALTER TABLE fleet_vehicles ADD COLUMN assigned_employee_id INTEGER REFERENCES employees(id);
ALTER TABLE fleet_vehicles ADD COLUMN assigned_driver_name TEXT;

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_tenant_assigned_employee
  ON fleet_vehicles (tenant_id, assigned_employee_id);
