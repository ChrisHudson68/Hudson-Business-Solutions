import type Database from 'better-sqlite3';

type DB = Database.Database;

export const FLEET_MAINTENANCE_CATEGORIES = [
  'oil_change',
  'tire_rotation',
  'inspection',
  'brakes',
  'tires',
  'engine',
  'transmission',
  'cooling',
  'electrical',
  'other',
] as const;

export type FleetMaintenanceCategory = (typeof FLEET_MAINTENANCE_CATEGORIES)[number];

export type FleetVehicleRecord = {
  id: number;
  tenant_id: number;
  display_name: string;
  unit_number: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  license_plate: string | null;
  vin: string | null;
  assigned_employee_id: number | null;
  assigned_employee_name: string | null;
  assigned_driver_name: string | null;
  active: number;
  notes: string | null;
  archived_at: string | null;
  archived_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type FleetAssignmentSummary = {
  assignedVehicles: number;
  unassignedVehicles: number;
};

export type FleetDriverOption = {
  id: number;
  name: string;
};

export type FleetAssignmentHistoryRecord = {
  id: number;
  tenant_id: number;
  vehicle_id: number;
  previous_employee_id: number | null;
  previous_employee_name: string | null;
  new_employee_id: number | null;
  new_employee_name: string | null;
  previous_driver_name: string | null;
  new_driver_name: string | null;
  note: string | null;
  changed_by_user_id: number | null;
  changed_by_user_name: string | null;
  changed_at: string;
};

export type FleetDashboardAlertSummary = {
  registrationExpiringSoon: number;
  registrationOverdue: number;
  insuranceExpiringSoon: number;
  insuranceOverdue: number;
};


export type FleetEntryRecord = {
  id: number;
  tenant_id: number;
  vehicle_id: number;
  vehicle_display_name: string;
  vehicle_unit_number: string | null;
  entry_type: 'fuel' | 'maintenance';
  entry_date: string;
  vendor: string | null;
  amount: number;
  odometer: number | null;
  gallons: number | null;
  service_type: string | null;
  maintenance_category: FleetMaintenanceCategory | null;
  notes: string | null;
  receipt_filename: string | null;
  archived_at: string | null;
  archived_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type FleetSummary = {
  activeVehicles: number;
  archivedVehicles: number;
  fuelMtd: number;
  maintenanceMtd: number;
  activeRecords: number;
  archivedRecords: number;
};

export type FleetVehicleDetailSummary = {
  totalSpend: number;
  fuelSpend: number;
  maintenanceSpend: number;
  fuelRecordCount: number;
  maintenanceRecordCount: number;
  activeRecordCount: number;
  archivedRecordCount: number;
  latestEntryDate: string | null;
  latestOdometer: number | null;
  fuelGallons: number;
  avgFuelCostPerGallon: number | null;
};

export type FleetFilters = {
  vehicleId?: number | null;
  entryType?: 'fuel' | 'maintenance' | 'all';
  archived?: 'active' | 'archived' | 'all';
  search?: string;
  maintenanceCategory?: FleetMaintenanceCategory | 'all';
  dateFrom?: string;
  dateTo?: string;
};

export type FleetReminderSettings = {
  oilChangeMiles: number;
  oilChangeDays: number;
  tireRotationMiles: number;
  tireRotationDays: number;
  inspectionDays: number;
};

export type FleetReminderStatus = {
  category: 'oil_change' | 'tire_rotation' | 'inspection';
  label: string;
  lastServiceDate: string | null;
  lastServiceOdometer: number | null;
  currentOdometer: number | null;
  dueAtDate: string | null;
  dueAtOdometer: number | null;
  milesRemaining: number | null;
  daysRemaining: number | null;
  isDue: boolean;
  reason: string;
};

function mapEntryRow(row: Record<string, unknown>): FleetEntryRecord {
  return {
    id: Number(row.id),
    tenant_id: Number(row.tenant_id),
    vehicle_id: Number(row.vehicle_id),
    vehicle_display_name: String(row.vehicle_display_name || ''),
    vehicle_unit_number: row.vehicle_unit_number ? String(row.vehicle_unit_number) : null,
    entry_type: String(row.entry_type) === 'maintenance' ? 'maintenance' : 'fuel',
    entry_date: String(row.entry_date || ''),
    vendor: row.vendor ? String(row.vendor) : null,
    amount: Number(row.amount || 0),
    odometer: typeof row.odometer === 'number' ? row.odometer : row.odometer === null ? null : Number(row.odometer || 0),
    gallons: typeof row.gallons === 'number' ? row.gallons : row.gallons === null ? null : Number(row.gallons || 0),
    service_type: row.service_type ? String(row.service_type) : null,
    maintenance_category: row.maintenance_category ? (String(row.maintenance_category) as FleetMaintenanceCategory) : null,
    notes: row.notes ? String(row.notes) : null,
    receipt_filename: row.receipt_filename ? String(row.receipt_filename) : null,
    archived_at: row.archived_at ? String(row.archived_at) : null,
    archived_by_user_id: typeof row.archived_by_user_id === 'number' ? row.archived_by_user_id : row.archived_by_user_id === null ? null : Number(row.archived_by_user_id || 0),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export function getMaintenanceCategoryLabel(category: string | null | undefined): string {
  switch (category) {
    case 'oil_change':
      return 'Oil Change';
    case 'tire_rotation':
      return 'Tire Rotation';
    case 'inspection':
      return 'Inspection';
    case 'brakes':
      return 'Brakes';
    case 'tires':
      return 'Tires';
    case 'engine':
      return 'Engine';
    case 'transmission':
      return 'Transmission';
    case 'cooling':
      return 'Cooling';
    case 'electrical':
      return 'Electrical';
    case 'other':
      return 'Other';
    default:
      return 'Uncategorized';
  }
}

export function listVehiclesByTenant(db: DB, tenantId: number, includeArchived = false): FleetVehicleRecord[] {
  const rows = db.prepare(`
    SELECT
      id,
      tenant_id,
      display_name,
      unit_number,
      year,
      make,
      model,
      license_plate,
      vin,
      assigned_employee_id,
      (SELECT name FROM employees e WHERE e.id = fleet_vehicles.assigned_employee_id AND e.tenant_id = fleet_vehicles.tenant_id LIMIT 1) AS assigned_employee_name,
      assigned_driver_name,
      active,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    FROM fleet_vehicles
    WHERE tenant_id = ? ${includeArchived ? '' : 'AND archived_at IS NULL'}
    ORDER BY archived_at IS NOT NULL ASC, active DESC, LOWER(display_name) ASC, id ASC
  `).all(tenantId) as FleetVehicleRecord[];

  return rows;
}

export function findVehicleById(db: DB, vehicleId: number, tenantId: number): FleetVehicleRecord | undefined {
  return db.prepare(`
    SELECT
      id,
      tenant_id,
      display_name,
      unit_number,
      year,
      make,
      model,
      license_plate,
      vin,
      assigned_employee_id,
      (SELECT name FROM employees e WHERE e.id = fleet_vehicles.assigned_employee_id AND e.tenant_id = fleet_vehicles.tenant_id LIMIT 1) AS assigned_employee_name,
      assigned_driver_name,
      active,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    FROM fleet_vehicles
    WHERE id = ? AND tenant_id = ?
    LIMIT 1
  `).get(vehicleId, tenantId) as FleetVehicleRecord | undefined;
}

export function createVehicle(
  db: DB,
  tenantId: number,
  data: {
    display_name: string;
    unit_number?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    license_plate?: string | null;
    vin?: string | null;
    assigned_employee_id?: number | null;
    assigned_driver_name?: string | null;
    active?: number;
    notes?: string | null;
  },
): number {
  const result = db.prepare(`
    INSERT INTO fleet_vehicles (
      tenant_id,
      display_name,
      unit_number,
      year,
      make,
      model,
      license_plate,
      vin,
      assigned_employee_id,
      assigned_driver_name,
      active,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    tenantId,
    data.display_name,
    data.unit_number || null,
    data.year ?? null,
    data.make || null,
    data.model || null,
    data.license_plate || null,
    data.vin || null,
    data.assigned_employee_id ?? null,
    data.assigned_driver_name || null,
    data.active === 0 ? 0 : 1,
    data.notes || null,
  );

  return Number(result.lastInsertRowid);
}

export function updateVehicle(
  db: DB,
  vehicleId: number,
  tenantId: number,
  data: {
    display_name: string;
    unit_number?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    license_plate?: string | null;
    vin?: string | null;
    assigned_employee_id?: number | null;
    assigned_driver_name?: string | null;
    active?: number;
    notes?: string | null;
  },
): void {
  db.prepare(`
    UPDATE fleet_vehicles
    SET
      display_name = ?,
      unit_number = ?,
      year = ?,
      make = ?,
      model = ?,
      license_plate = ?,
      vin = ?,
      assigned_employee_id = ?,
      assigned_driver_name = ?,
      active = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(
    data.display_name,
    data.unit_number || null,
    data.year ?? null,
    data.make || null,
    data.model || null,
    data.license_plate || null,
    data.vin || null,
    data.assigned_employee_id ?? null,
    data.assigned_driver_name || null,
    data.active === 0 ? 0 : 1,
    data.notes || null,
    vehicleId,
    tenantId,
  );
}

export function archiveVehicle(db: DB, vehicleId: number, tenantId: number, archivedByUserId: number): void {
  db.prepare(`
    UPDATE fleet_vehicles
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
  `).run(archivedByUserId, vehicleId, tenantId);
}

export function restoreVehicle(db: DB, vehicleId: number, tenantId: number): void {
  db.prepare(`
    UPDATE fleet_vehicles
    SET archived_at = NULL,
        archived_by_user_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND archived_at IS NOT NULL
  `).run(vehicleId, tenantId);
}

function buildEntryFilterSql(filters?: FleetFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.vehicleId) {
    clauses.push('fe.vehicle_id = ?');
    params.push(filters.vehicleId);
  }

  if (filters?.entryType && filters.entryType !== 'all') {
    clauses.push('fe.entry_type = ?');
    params.push(filters.entryType);
  }

  if (filters?.archived === 'active') {
    clauses.push('fe.archived_at IS NULL');
  } else if (filters?.archived === 'archived') {
    clauses.push('fe.archived_at IS NOT NULL');
  }

  if (filters?.maintenanceCategory && filters.maintenanceCategory !== 'all') {
    clauses.push('fe.maintenance_category = ?');
    params.push(filters.maintenanceCategory);
  }

  if (filters?.dateFrom) {
    clauses.push('fe.entry_date >= ?');
    params.push(filters.dateFrom);
  }

  if (filters?.dateTo) {
    clauses.push('fe.entry_date <= ?');
    params.push(filters.dateTo);
  }

  const search = String(filters?.search || '').trim();
  if (search) {
    clauses.push(`(
      LOWER(COALESCE(fv.display_name, '')) LIKE ?
      OR LOWER(COALESCE(fv.unit_number, '')) LIKE ?
      OR LOWER(COALESCE(fe.vendor, '')) LIKE ?
      OR LOWER(COALESCE(fe.service_type, '')) LIKE ?
      OR LOWER(COALESCE(fe.maintenance_category, '')) LIKE ?
      OR LOWER(COALESCE(fe.notes, '')) LIKE ?
    )`);
    const pattern = `%${search.toLowerCase()}%`;
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }

  return {
    sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function listEntriesByTenant(
  db: DB,
  tenantId: number,
  includeArchived = false,
  filters?: FleetFilters,
): FleetEntryRecord[] {
  const archived = includeArchived ? filters?.archived || 'all' : 'active';
  const { sql, params } = buildEntryFilterSql({ ...filters, archived });
  const rows = db.prepare(`
    SELECT
      fe.id,
      fe.tenant_id,
      fe.vehicle_id,
      fv.display_name AS vehicle_display_name,
      fv.unit_number AS vehicle_unit_number,
      fe.entry_type,
      fe.entry_date,
      fe.vendor,
      fe.amount,
      fe.odometer,
      fe.gallons,
      fe.service_type,
      fe.maintenance_category,
      fe.notes,
      fe.receipt_filename,
      fe.archived_at,
      fe.archived_by_user_id,
      fe.created_at,
      fe.updated_at
    FROM fleet_entries fe
    INNER JOIN fleet_vehicles fv ON fv.id = fe.vehicle_id AND fv.tenant_id = fe.tenant_id
    WHERE fe.tenant_id = ?${sql}
    ORDER BY fe.archived_at IS NOT NULL ASC, fe.entry_date DESC, fe.id DESC
  `).all(tenantId, ...params) as Record<string, unknown>[];

  return rows.map(mapEntryRow);
}

export function listEntriesForVehicle(
  db: DB,
  tenantId: number,
  vehicleId: number,
  includeArchived = true,
  limit?: number,
): FleetEntryRecord[] {
  const limitClause = typeof limit === 'number' && limit > 0 ? `LIMIT ${Math.floor(limit)}` : '';
  const rows = db.prepare(`
    SELECT
      fe.id,
      fe.tenant_id,
      fe.vehicle_id,
      fv.display_name AS vehicle_display_name,
      fv.unit_number AS vehicle_unit_number,
      fe.entry_type,
      fe.entry_date,
      fe.vendor,
      fe.amount,
      fe.odometer,
      fe.gallons,
      fe.service_type,
      fe.maintenance_category,
      fe.notes,
      fe.receipt_filename,
      fe.archived_at,
      fe.archived_by_user_id,
      fe.created_at,
      fe.updated_at
    FROM fleet_entries fe
    INNER JOIN fleet_vehicles fv ON fv.id = fe.vehicle_id AND fv.tenant_id = fe.tenant_id
    WHERE fe.tenant_id = ?
      AND fe.vehicle_id = ?
      ${includeArchived ? '' : 'AND fe.archived_at IS NULL'}
    ORDER BY fe.archived_at IS NOT NULL ASC, fe.entry_date DESC, fe.id DESC
    ${limitClause}
  `).all(tenantId, vehicleId) as Record<string, unknown>[];

  return rows.map(mapEntryRow);
}

export function findEntryById(db: DB, entryId: number, tenantId: number): FleetEntryRecord | undefined {
  const row = db.prepare(`
    SELECT
      fe.id,
      fe.tenant_id,
      fe.vehicle_id,
      fv.display_name AS vehicle_display_name,
      fv.unit_number AS vehicle_unit_number,
      fe.entry_type,
      fe.entry_date,
      fe.vendor,
      fe.amount,
      fe.odometer,
      fe.gallons,
      fe.service_type,
      fe.maintenance_category,
      fe.notes,
      fe.receipt_filename,
      fe.archived_at,
      fe.archived_by_user_id,
      fe.created_at,
      fe.updated_at
    FROM fleet_entries fe
    INNER JOIN fleet_vehicles fv ON fv.id = fe.vehicle_id AND fv.tenant_id = fe.tenant_id
    WHERE fe.id = ? AND fe.tenant_id = ?
    LIMIT 1
  `).get(entryId, tenantId) as Record<string, unknown> | undefined;

  return row ? mapEntryRow(row) : undefined;
}

export function createEntry(
  db: DB,
  tenantId: number,
  data: {
    vehicle_id: number;
    entry_type: 'fuel' | 'maintenance';
    entry_date: string;
    vendor?: string | null;
    amount: number;
    odometer?: number | null;
    gallons?: number | null;
    service_type?: string | null;
    maintenance_category?: FleetMaintenanceCategory | null;
    notes?: string | null;
    receipt_filename?: string | null;
  },
): number {
  const result = db.prepare(`
    INSERT INTO fleet_entries (
      tenant_id,
      vehicle_id,
      entry_type,
      entry_date,
      vendor,
      amount,
      odometer,
      gallons,
      service_type,
      maintenance_category,
      notes,
      receipt_filename,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    tenantId,
    data.vehicle_id,
    data.entry_type,
    data.entry_date,
    data.vendor || null,
    Number(data.amount || 0),
    data.odometer ?? null,
    data.gallons ?? null,
    data.service_type || null,
    data.entry_type === 'maintenance' ? data.maintenance_category || 'other' : null,
    data.notes || null,
    data.receipt_filename || null,
  );

  return Number(result.lastInsertRowid);
}

export function updateEntry(
  db: DB,
  entryId: number,
  tenantId: number,
  data: {
    vehicle_id: number;
    entry_type: 'fuel' | 'maintenance';
    entry_date: string;
    vendor?: string | null;
    amount: number;
    odometer?: number | null;
    gallons?: number | null;
    service_type?: string | null;
    maintenance_category?: FleetMaintenanceCategory | null;
    notes?: string | null;
    receipt_filename?: string | null;
  },
): void {
  db.prepare(`
    UPDATE fleet_entries
    SET
      vehicle_id = ?,
      entry_type = ?,
      entry_date = ?,
      vendor = ?,
      amount = ?,
      odometer = ?,
      gallons = ?,
      service_type = ?,
      maintenance_category = ?,
      notes = ?,
      receipt_filename = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(
    data.vehicle_id,
    data.entry_type,
    data.entry_date,
    data.vendor || null,
    Number(data.amount || 0),
    data.odometer ?? null,
    data.gallons ?? null,
    data.service_type || null,
    data.entry_type === 'maintenance' ? data.maintenance_category || 'other' : null,
    data.notes || null,
    data.receipt_filename || null,
    entryId,
    tenantId,
  );
}

export function archiveEntry(db: DB, entryId: number, tenantId: number, archivedByUserId: number): void {
  db.prepare(`
    UPDATE fleet_entries
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
  `).run(archivedByUserId, entryId, tenantId);
}

export function restoreEntry(db: DB, entryId: number, tenantId: number): void {
  db.prepare(`
    UPDATE fleet_entries
    SET archived_at = NULL,
        archived_by_user_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND archived_at IS NOT NULL
  `).run(entryId, tenantId);
}

export function summarizeByTenant(db: DB, tenantId: number, monthStart: string, monthEnd: string): FleetSummary {
  const vehicleCounts = db.prepare(`
    SELECT
      SUM(CASE WHEN archived_at IS NULL AND active = 1 THEN 1 ELSE 0 END) AS active_vehicles,
      SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived_vehicles
    FROM fleet_vehicles
    WHERE tenant_id = ?
  `).get(tenantId) as { active_vehicles?: number; archived_vehicles?: number } | undefined;

  const mtd = db.prepare(`
    SELECT
      SUM(CASE WHEN entry_type = 'fuel' AND archived_at IS NULL THEN amount ELSE 0 END) AS fuel_mtd,
      SUM(CASE WHEN entry_type = 'maintenance' AND archived_at IS NULL THEN amount ELSE 0 END) AS maintenance_mtd
    FROM fleet_entries
    WHERE tenant_id = ?
      AND entry_date >= ?
      AND entry_date <= ?
  `).get(tenantId, monthStart, monthEnd) as {
    fuel_mtd?: number;
    maintenance_mtd?: number;
  } | undefined;

  const recordCounts = db.prepare(`
    SELECT
      SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) AS active_records,
      SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) AS archived_records
    FROM fleet_entries
    WHERE tenant_id = ?
  `).get(tenantId) as { active_records?: number; archived_records?: number } | undefined;

  return {
    activeVehicles: Number(vehicleCounts?.active_vehicles || 0),
    archivedVehicles: Number(vehicleCounts?.archived_vehicles || 0),
    fuelMtd: Number(mtd?.fuel_mtd || 0),
    maintenanceMtd: Number(mtd?.maintenance_mtd || 0),
    activeRecords: Number(recordCounts?.active_records || 0),
    archivedRecords: Number(recordCounts?.archived_records || 0),
  };
}

export function summarizeVehicleById(db: DB, tenantId: number, vehicleId: number): FleetVehicleDetailSummary {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN archived_at IS NULL THEN amount ELSE 0 END), 0) AS total_spend,
      COALESCE(SUM(CASE WHEN archived_at IS NULL AND entry_type = 'fuel' THEN amount ELSE 0 END), 0) AS fuel_spend,
      COALESCE(SUM(CASE WHEN archived_at IS NULL AND entry_type = 'maintenance' THEN amount ELSE 0 END), 0) AS maintenance_spend,
      COALESCE(SUM(CASE WHEN archived_at IS NULL AND entry_type = 'fuel' THEN 1 ELSE 0 END), 0) AS fuel_record_count,
      COALESCE(SUM(CASE WHEN archived_at IS NULL AND entry_type = 'maintenance' THEN 1 ELSE 0 END), 0) AS maintenance_record_count,
      COALESCE(SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END), 0) AS active_record_count,
      COALESCE(SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS archived_record_count,
      MAX(CASE WHEN archived_at IS NULL THEN entry_date ELSE NULL END) AS latest_entry_date,
      COALESCE(SUM(CASE WHEN archived_at IS NULL AND entry_type = 'fuel' THEN gallons ELSE 0 END), 0) AS fuel_gallons
    FROM fleet_entries
    WHERE tenant_id = ? AND vehicle_id = ?
  `).get(tenantId, vehicleId) as {
    total_spend?: number;
    fuel_spend?: number;
    maintenance_spend?: number;
    fuel_record_count?: number;
    maintenance_record_count?: number;
    active_record_count?: number;
    archived_record_count?: number;
    latest_entry_date?: string | null;
    fuel_gallons?: number;
  } | undefined;

  const latestOdometerRow = db.prepare(`
    SELECT odometer
    FROM fleet_entries
    WHERE tenant_id = ?
      AND vehicle_id = ?
      AND archived_at IS NULL
      AND odometer IS NOT NULL
    ORDER BY entry_date DESC, id DESC
    LIMIT 1
  `).get(tenantId, vehicleId) as { odometer?: number | null } | undefined;

  const fuelSpend = Number(row?.fuel_spend || 0);
  const fuelGallons = Number(row?.fuel_gallons || 0);

  return {
    totalSpend: Number(row?.total_spend || 0),
    fuelSpend,
    maintenanceSpend: Number(row?.maintenance_spend || 0),
    fuelRecordCount: Number(row?.fuel_record_count || 0),
    maintenanceRecordCount: Number(row?.maintenance_record_count || 0),
    activeRecordCount: Number(row?.active_record_count || 0),
    archivedRecordCount: Number(row?.archived_record_count || 0),
    latestEntryDate: row?.latest_entry_date || null,
    latestOdometer: typeof latestOdometerRow?.odometer === 'number' ? latestOdometerRow.odometer : null,
    fuelGallons,
    avgFuelCostPerGallon: fuelGallons > 0 ? Number((fuelSpend / fuelGallons).toFixed(3)) : null,
  };
}

export function getFleetReminderSettings(db: DB, tenantId: number): FleetReminderSettings {
  const row = db.prepare(`
    SELECT
      fleet_oil_change_miles,
      fleet_oil_change_days,
      fleet_tire_rotation_miles,
      fleet_tire_rotation_days,
      fleet_inspection_days
    FROM tenants
    WHERE id = ?
    LIMIT 1
  `).get(tenantId) as Record<string, unknown> | undefined;

  return {
    oilChangeMiles: Number(row?.fleet_oil_change_miles || 0),
    oilChangeDays: Number(row?.fleet_oil_change_days || 0),
    tireRotationMiles: Number(row?.fleet_tire_rotation_miles || 0),
    tireRotationDays: Number(row?.fleet_tire_rotation_days || 0),
    inspectionDays: Number(row?.fleet_inspection_days || 0),
  };
}

function addDays(dateIso: string, days: number): string | null {
  if (!dateIso || days <= 0) return null;
  const date = new Date(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(`${dateIso}T00:00:00Z`);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUtc - today) / 86400000);
}

export function getVehicleReminderStatuses(
  db: DB,
  tenantId: number,
  vehicleId: number,
  settings: FleetReminderSettings,
  currentOdometer: number | null,
): FleetReminderStatus[] {
  const categories: Array<{
    key: 'oil_change' | 'tire_rotation' | 'inspection';
    label: string;
    milesInterval: number;
    daysInterval: number;
  }> = [
    {
      key: 'oil_change',
      label: 'Oil Change',
      milesInterval: settings.oilChangeMiles,
      daysInterval: settings.oilChangeDays,
    },
    {
      key: 'tire_rotation',
      label: 'Tire Rotation',
      milesInterval: settings.tireRotationMiles,
      daysInterval: settings.tireRotationDays,
    },
    {
      key: 'inspection',
      label: 'Inspection',
      milesInterval: 0,
      daysInterval: settings.inspectionDays,
    },
  ];

  return categories.map((category) => {
    const lastService = db.prepare(`
      SELECT entry_date, odometer
      FROM fleet_entries
      WHERE tenant_id = ?
        AND vehicle_id = ?
        AND entry_type = 'maintenance'
        AND archived_at IS NULL
        AND maintenance_category = ?
      ORDER BY entry_date DESC, id DESC
      LIMIT 1
    `).get(tenantId, vehicleId, category.key) as { entry_date?: string | null; odometer?: number | null } | undefined;

    const lastServiceDate = lastService?.entry_date || null;
    const lastServiceOdometer = typeof lastService?.odometer === 'number' ? lastService.odometer : null;
    const dueAtDate = category.daysInterval > 0 ? addDays(lastServiceDate || new Date().toISOString().slice(0, 10), category.daysInterval) : null;
    const dueAtOdometer = category.milesInterval > 0 && lastServiceOdometer !== null ? lastServiceOdometer + category.milesInterval : null;
    const milesRemaining = dueAtOdometer !== null && currentOdometer !== null ? dueAtOdometer - currentOdometer : null;
    const daysRemaining = category.daysInterval > 0 ? daysUntil(dueAtDate) : null;

    let isDue = false;
    if (!lastServiceDate) {
      isDue = true;
    } else if (typeof milesRemaining === 'number' && milesRemaining <= 0) {
      isDue = true;
    } else if (typeof daysRemaining === 'number' && daysRemaining <= 0) {
      isDue = true;
    }

    let reason = 'Up to date';
    if (!lastServiceDate) {
      reason = 'No service logged yet';
    } else if (typeof milesRemaining === 'number' && milesRemaining <= 0) {
      reason = `${Math.abs(milesRemaining).toLocaleString('en-US')} miles overdue`;
    } else if (typeof daysRemaining === 'number' && daysRemaining <= 0) {
      reason = `${Math.abs(daysRemaining)} days overdue`;
    } else {
      const parts: string[] = [];
      if (typeof milesRemaining === 'number') {
        parts.push(`${milesRemaining.toLocaleString('en-US')} miles left`);
      }
      if (typeof daysRemaining === 'number') {
        parts.push(`${daysRemaining} days left`);
      }
      if (parts.length > 0) {
        reason = parts.join(' • ');
      }
    }

    return {
      category: category.key,
      label: category.label,
      lastServiceDate,
      lastServiceOdometer,
      currentOdometer,
      dueAtDate,
      dueAtOdometer,
      milesRemaining,
      daysRemaining,
      isDue,
      reason,
    };
  });
}


export function listFleetDriverOptions(db: DB, tenantId: number): FleetDriverOption[] {
  return db.prepare(`
    SELECT id, name
    FROM employees
    WHERE tenant_id = ? AND active = 1
    ORDER BY LOWER(name) ASC, id ASC
  `).all(tenantId) as FleetDriverOption[];
}

export function summarizeAssignmentsByTenant(db: DB, tenantId: number): FleetAssignmentSummary {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN archived_at IS NULL AND assigned_employee_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS assignedVehicles,
      COALESCE(SUM(CASE WHEN archived_at IS NULL AND assigned_employee_id IS NULL THEN 1 ELSE 0 END), 0) AS unassignedVehicles
    FROM fleet_vehicles
    WHERE tenant_id = ?
  `).get(tenantId) as Record<string, unknown>;

  return {
    assignedVehicles: Number(row?.assignedVehicles || 0),
    unassignedVehicles: Number(row?.unassignedVehicles || 0),
  };
}

export type FleetExpiringDocumentWidgetItem = {
  id: number;
  vehicle_id: number;
  vehicle_display_name: string;
  title: string;
  document_type: FleetDocumentType;
  expiration_date: string | null;
  days_remaining: number | null;
};

export function listExpiringDocumentWidgetsByTenant(db: DB, tenantId: number, daysAhead = 30): FleetExpiringDocumentWidgetItem[] {
  return listExpiringDocumentsByTenant(db, tenantId, daysAhead)
    .map((document) => {
      const vehicle = findVehicleById(db, document.vehicle_id, tenantId);
      return {
        id: document.id,
        vehicle_id: document.vehicle_id,
        vehicle_display_name: vehicle?.display_name || `Vehicle #${document.vehicle_id}`,
        title: document.title,
        document_type: document.document_type,
        expiration_date: document.expiration_date,
        days_remaining: document.expiration_date ? daysUntil(document.expiration_date) : null,
      };
    })
    .sort((a, b) => {
      const aDays = a.days_remaining ?? 999999;
      const bDays = b.days_remaining ?? 999999;
      if (aDays !== bDays) return aDays - bDays;
      return a.vehicle_display_name.localeCompare(b.vehicle_display_name);
    });
}

export const FLEET_DOCUMENT_TYPES = [
  'registration',
  'insurance',
  'inspection',
  'service_contract',
  'other',
] as const;

export type FleetDocumentType = (typeof FLEET_DOCUMENT_TYPES)[number];

export type FleetDocumentRecord = {
  id: number;
  tenant_id: number;
  vehicle_id: number;
  document_type: FleetDocumentType;
  title: string;
  file_filename: string;
  original_filename: string | null;
  expiration_date: string | null;
  notes: string | null;
  archived_at: string | null;
  archived_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

export type FleetAttachmentHistoryItem = {
  source_type: 'receipt' | 'document';
  id: number;
  entry_or_document_date: string | null;
  label: string;
  kind: string;
  filename: string;
  archived_at: string | null;
};

export type FleetScheduleRow = {
  vehicle_id: number;
  vehicle_display_name: string;
  current_odometer: number | null;
  reminder: FleetReminderStatus;
  expiringDocuments: FleetDocumentRecord[];
};

function mapDocumentRow(row: Record<string, unknown>): FleetDocumentRecord {
  return {
    id: Number(row.id),
    tenant_id: Number(row.tenant_id),
    vehicle_id: Number(row.vehicle_id),
    document_type: String(row.document_type || 'other') as FleetDocumentType,
    title: String(row.title || ''),
    file_filename: String(row.file_filename || ''),
    original_filename: row.original_filename ? String(row.original_filename) : null,
    expiration_date: row.expiration_date ? String(row.expiration_date) : null,
    notes: row.notes ? String(row.notes) : null,
    archived_at: row.archived_at ? String(row.archived_at) : null,
    archived_by_user_id: typeof row.archived_by_user_id === 'number'
      ? row.archived_by_user_id
      : row.archived_by_user_id === null
        ? null
        : Number(row.archived_by_user_id || 0),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export function getFleetDocumentTypeLabel(documentType: string | null | undefined): string {
  switch (documentType) {
    case 'registration':
      return 'Registration';
    case 'insurance':
      return 'Insurance';
    case 'inspection':
      return 'Inspection';
    case 'service_contract':
      return 'Service Contract';
    case 'other':
    default:
      return 'Other';
  }
}

export function listDocumentsForVehicle(
  db: DB,
  tenantId: number,
  vehicleId: number,
  includeArchived = false,
): FleetDocumentRecord[] {
  const rows = db.prepare(`
    SELECT
      id,
      tenant_id,
      vehicle_id,
      document_type,
      title,
      file_filename,
      original_filename,
      expiration_date,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    FROM fleet_documents
    WHERE tenant_id = ?
      AND vehicle_id = ?
      ${includeArchived ? '' : 'AND archived_at IS NULL'}
    ORDER BY archived_at IS NOT NULL ASC,
             expiration_date IS NULL ASC,
             expiration_date ASC,
             created_at DESC,
             id DESC
  `).all(tenantId, vehicleId) as Record<string, unknown>[];

  return rows.map(mapDocumentRow);
}

export function listExpiringDocumentsByTenant(
  db: DB,
  tenantId: number,
  daysAhead = 30,
): FleetDocumentRecord[] {
  const today = new Date().toISOString().slice(0, 10);
  const cutoffDate = addDays(today, daysAhead) || today;
  const rows = db.prepare(`
    SELECT
      id,
      tenant_id,
      vehicle_id,
      document_type,
      title,
      file_filename,
      original_filename,
      expiration_date,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    FROM fleet_documents
    WHERE tenant_id = ?
      AND archived_at IS NULL
      AND expiration_date IS NOT NULL
      AND expiration_date <= ?
    ORDER BY expiration_date ASC, id ASC
  `).all(tenantId, cutoffDate) as Record<string, unknown>[];

  return rows.map(mapDocumentRow);
}

export function findDocumentById(db: DB, documentId: number, tenantId: number): FleetDocumentRecord | undefined {
  const row = db.prepare(`
    SELECT
      id,
      tenant_id,
      vehicle_id,
      document_type,
      title,
      file_filename,
      original_filename,
      expiration_date,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    FROM fleet_documents
    WHERE id = ? AND tenant_id = ?
    LIMIT 1
  `).get(documentId, tenantId) as Record<string, unknown> | undefined;

  return row ? mapDocumentRow(row) : undefined;
}

export function createDocument(
  db: DB,
  tenantId: number,
  data: {
    vehicle_id: number;
    document_type: FleetDocumentType;
    title: string;
    file_filename: string;
    original_filename?: string | null;
    expiration_date?: string | null;
    notes?: string | null;
  },
): number {
  const result = db.prepare(`
    INSERT INTO fleet_documents (
      tenant_id,
      vehicle_id,
      document_type,
      title,
      file_filename,
      original_filename,
      expiration_date,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    tenantId,
    data.vehicle_id,
    data.document_type,
    data.title,
    data.file_filename,
    data.original_filename || null,
    data.expiration_date || null,
    data.notes || null,
  );

  return Number(result.lastInsertRowid);
}

export function updateDocument(
  db: DB,
  documentId: number,
  tenantId: number,
  data: {
    vehicle_id: number;
    document_type: FleetDocumentType;
    title: string;
    file_filename?: string | null;
    original_filename?: string | null;
    expiration_date?: string | null;
    notes?: string | null;
  },
): void {
  const fields = [
    'vehicle_id = ?',
    'document_type = ?',
    'title = ?',
    'expiration_date = ?',
    'notes = ?',
    'updated_at = CURRENT_TIMESTAMP',
  ];
  const values: unknown[] = [
    data.vehicle_id,
    data.document_type,
    data.title,
    data.expiration_date || null,
    data.notes || null,
  ];

  if (data.file_filename !== undefined) {
    fields.splice(3, 0, 'file_filename = ?', 'original_filename = ?');
    values.splice(3, 0, data.file_filename, data.original_filename || null);
  }

  values.push(documentId, tenantId);

  db.prepare(`
    UPDATE fleet_documents
    SET ${fields.join(', ')}
    WHERE id = ? AND tenant_id = ?
  `).run(...values);
}

export function archiveDocument(db: DB, documentId: number, tenantId: number, archivedByUserId: number): void {
  db.prepare(`
    UPDATE fleet_documents
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
  `).run(archivedByUserId, documentId, tenantId);
}

export function restoreDocument(db: DB, documentId: number, tenantId: number): void {
  db.prepare(`
    UPDATE fleet_documents
    SET archived_at = NULL,
        archived_by_user_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(documentId, tenantId);
}

export function listAttachmentHistoryForVehicle(
  db: DB,
  tenantId: number,
  vehicleId: number,
  includeArchived = true,
  limit = 50,
): FleetAttachmentHistoryItem[] {
  const limitValue = Math.max(1, Math.min(limit, 200));
  const receiptRows = db.prepare(`
    SELECT
      'receipt' AS source_type,
      id,
      entry_date AS entry_or_document_date,
      CASE
        WHEN entry_type = 'fuel' THEN 'Fuel Receipt'
        ELSE COALESCE(service_type, 'Maintenance Receipt')
      END AS label,
      entry_type AS kind,
      receipt_filename AS filename,
      archived_at
    FROM fleet_entries
    WHERE tenant_id = ?
      AND vehicle_id = ?
      AND receipt_filename IS NOT NULL
      ${includeArchived ? '' : 'AND archived_at IS NULL'}
  `).all(tenantId, vehicleId) as Record<string, unknown>[];

  const documentRows = db.prepare(`
    SELECT
      'document' AS source_type,
      id,
      COALESCE(expiration_date, created_at) AS entry_or_document_date,
      title AS label,
      document_type AS kind,
      file_filename AS filename,
      archived_at
    FROM fleet_documents
    WHERE tenant_id = ?
      AND vehicle_id = ?
      ${includeArchived ? '' : 'AND archived_at IS NULL'}
  `).all(tenantId, vehicleId) as Record<string, unknown>[];

  return [...receiptRows, ...documentRows]
    .map((row) => ({
      source_type: (String(row.source_type) === 'receipt' ? 'receipt' : 'document') as 'receipt' | 'document',
      id: Number(row.id),
      entry_or_document_date: row.entry_or_document_date ? String(row.entry_or_document_date) : null,
      label: String(row.label || ''),
      kind: String(row.kind || ''),
      filename: String(row.filename || ''),
      archived_at: row.archived_at ? String(row.archived_at) : null,
    }))
    .sort((a, b) => {
      const aDate = a.entry_or_document_date || '';
      const bDate = b.entry_or_document_date || '';
      if (aDate === bDate) return b.id - a.id;
      return bDate.localeCompare(aDate);
    })
    .slice(0, limitValue);
}

export function listFleetScheduleRows(
  db: DB,
  tenantId: number,
  daysAhead = 30,
): FleetScheduleRow[] {
  const vehicles = listVehiclesByTenant(db, tenantId, false);
  const settings = getFleetReminderSettings(db, tenantId);

  return vehicles
    .map((vehicle) => {
      const summary = summarizeVehicleById(db, tenantId, vehicle.id);
      const reminders = getVehicleReminderStatuses(db, tenantId, vehicle.id, settings, summary.latestOdometer);
      const expiringDocuments = listDocumentsForVehicle(db, tenantId, vehicle.id, false).filter((doc) => {
        if (!doc.expiration_date) return false;
        const days = daysUntil(doc.expiration_date);
        return days !== null && days <= daysAhead;
      });

      return reminders.map((reminder) => ({
        vehicle_id: vehicle.id,
        vehicle_display_name: vehicle.display_name,
        current_odometer: summary.latestOdometer,
        reminder,
        expiringDocuments,
      }));
    })
    .flat()
    .sort((a, b) => {
      if (a.reminder.isDue !== b.reminder.isDue) {
        return a.reminder.isDue ? -1 : 1;
      }
      const aDays = a.reminder.daysRemaining ?? 999999;
      const bDays = b.reminder.daysRemaining ?? 999999;
      if (aDays !== bDays) return aDays - bDays;
      return a.vehicle_display_name.localeCompare(b.vehicle_display_name);
    });
}


export function createAssignmentHistory(
  db: DB,
  tenantId: number,
  data: {
    vehicle_id: number;
    previous_employee_id?: number | null;
    new_employee_id?: number | null;
    previous_driver_name?: string | null;
    new_driver_name?: string | null;
    note?: string | null;
    changed_by_user_id?: number | null;
  },
): number {
  const result = db.prepare(`
    INSERT INTO fleet_vehicle_assignment_history (
      tenant_id,
      vehicle_id,
      previous_employee_id,
      new_employee_id,
      previous_driver_name,
      new_driver_name,
      note,
      changed_by_user_id,
      changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    tenantId,
    data.vehicle_id,
    data.previous_employee_id ?? null,
    data.new_employee_id ?? null,
    data.previous_driver_name || null,
    data.new_driver_name || null,
    data.note || null,
    data.changed_by_user_id ?? null,
  );

  return Number(result.lastInsertRowid);
}

export function listAssignmentHistoryForVehicle(
  db: DB,
  tenantId: number,
  vehicleId: number,
  limit = 20,
): FleetAssignmentHistoryRecord[] {
  const limitValue = Math.max(1, Math.min(limit, 100));
  const rows = db.prepare(`
    SELECT
      h.id,
      h.tenant_id,
      h.vehicle_id,
      h.previous_employee_id,
      prev_emp.name AS previous_employee_name,
      h.new_employee_id,
      new_emp.name AS new_employee_name,
      h.previous_driver_name,
      h.new_driver_name,
      h.note,
      h.changed_by_user_id,
      changed_user.name AS changed_by_user_name,
      h.changed_at
    FROM fleet_vehicle_assignment_history h
    LEFT JOIN employees prev_emp
      ON prev_emp.id = h.previous_employee_id
     AND prev_emp.tenant_id = h.tenant_id
    LEFT JOIN employees new_emp
      ON new_emp.id = h.new_employee_id
     AND new_emp.tenant_id = h.tenant_id
    LEFT JOIN users changed_user
      ON changed_user.id = h.changed_by_user_id
     AND changed_user.tenant_id = h.tenant_id
    WHERE h.tenant_id = ?
      AND h.vehicle_id = ?
    ORDER BY h.changed_at DESC, h.id DESC
    LIMIT ?
  `).all(tenantId, vehicleId, limitValue) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    tenant_id: Number(row.tenant_id),
    vehicle_id: Number(row.vehicle_id),
    previous_employee_id: typeof row.previous_employee_id === 'number' ? row.previous_employee_id : row.previous_employee_id === null ? null : Number(row.previous_employee_id || 0),
    previous_employee_name: row.previous_employee_name ? String(row.previous_employee_name) : null,
    new_employee_id: typeof row.new_employee_id === 'number' ? row.new_employee_id : row.new_employee_id === null ? null : Number(row.new_employee_id || 0),
    new_employee_name: row.new_employee_name ? String(row.new_employee_name) : null,
    previous_driver_name: row.previous_driver_name ? String(row.previous_driver_name) : null,
    new_driver_name: row.new_driver_name ? String(row.new_driver_name) : null,
    note: row.note ? String(row.note) : null,
    changed_by_user_id: typeof row.changed_by_user_id === 'number' ? row.changed_by_user_id : row.changed_by_user_id === null ? null : Number(row.changed_by_user_id || 0),
    changed_by_user_name: row.changed_by_user_name ? String(row.changed_by_user_name) : null,
    changed_at: String(row.changed_at || ''),
  }));
}

export function summarizeDashboardAlertsByTenant(db: DB, tenantId: number, daysAhead = 30): FleetDashboardAlertSummary {
  const docs = listExpiringDocumentWidgetsByTenant(db, tenantId, daysAhead);

  const summary: FleetDashboardAlertSummary = {
    registrationExpiringSoon: 0,
    registrationOverdue: 0,
    insuranceExpiringSoon: 0,
    insuranceOverdue: 0,
  };

  for (const doc of docs) {
    const daysRemaining = doc.days_remaining;
    if (doc.document_type === 'registration') {
      if (daysRemaining !== null && daysRemaining < 0) {
        summary.registrationOverdue += 1;
      } else {
        summary.registrationExpiringSoon += 1;
      }
    }
    if (doc.document_type === 'insurance') {
      if (daysRemaining !== null && daysRemaining < 0) {
        summary.insuranceOverdue += 1;
      } else {
        summary.insuranceExpiringSoon += 1;
      }
    }
  }

  return summary;
}
