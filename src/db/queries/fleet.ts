import type Database from 'better-sqlite3';

type DB = Database.Database;

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
  active: number;
  notes: string | null;
  archived_at: string | null;
  archived_by_user_id: number | null;
  created_at: string;
  updated_at: string;
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

function archivedVehicleClause(includeArchived = false): string {
  return includeArchived ? '' : 'AND archived_at IS NULL';
}

function archivedEntryClause(includeArchived = false): string {
  return includeArchived ? '' : 'AND fe.archived_at IS NULL';
}

export function listVehiclesByTenant(db: DB, tenantId: number, includeArchived = false): FleetVehicleRecord[] {
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
      active,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    FROM fleet_vehicles
    WHERE tenant_id = ? ${archivedVehicleClause(includeArchived)}
    ORDER BY archived_at IS NOT NULL ASC, active DESC, LOWER(display_name) ASC, id ASC
  `).all(tenantId) as FleetVehicleRecord[];
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
      active,
      notes,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    tenantId,
    data.display_name,
    data.unit_number || null,
    data.year ?? null,
    data.make || null,
    data.model || null,
    data.license_plate || null,
    data.vin || null,
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

export function listEntriesByTenant(db: DB, tenantId: number, includeArchived = false): FleetEntryRecord[] {
  return db.prepare(`
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
      fe.notes,
      fe.receipt_filename,
      fe.archived_at,
      fe.archived_by_user_id,
      fe.created_at,
      fe.updated_at
    FROM fleet_entries fe
    INNER JOIN fleet_vehicles fv ON fv.id = fe.vehicle_id AND fv.tenant_id = fe.tenant_id
    WHERE fe.tenant_id = ? ${archivedEntryClause(includeArchived)}
    ORDER BY fe.archived_at IS NOT NULL ASC, fe.entry_date DESC, fe.id DESC
  `).all(tenantId) as FleetEntryRecord[];
}

export function listEntriesForVehicle(
  db: DB,
  tenantId: number,
  vehicleId: number,
  includeArchived = true,
  limit?: number,
): FleetEntryRecord[] {
  const limitClause = typeof limit === 'number' && limit > 0 ? `LIMIT ${Math.floor(limit)}` : '';
  return db.prepare(`
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
  `).all(tenantId, vehicleId) as FleetEntryRecord[];
}

export function findEntryById(db: DB, entryId: number, tenantId: number): FleetEntryRecord | undefined {
  return db.prepare(`
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
  `).get(entryId, tenantId) as FleetEntryRecord | undefined;
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
      notes,
      receipt_filename,
      archived_at,
      archived_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
