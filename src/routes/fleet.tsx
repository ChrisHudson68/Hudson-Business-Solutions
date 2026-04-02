import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as fleet from '../db/queries/fleet.js';
import { permissionRequired, userHasPermission } from '../middleware/auth.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { FleetPage } from '../pages/fleet/FleetPage.js';
import { FleetVehicleDetailPage } from '../pages/fleet/FleetVehicleDetailPage.js';
import { FleetSchedulePage } from '../pages/fleet/FleetSchedulePage.js';
import { getEnv } from '../config/env.js';
import {
  saveUploadedFile,
  deleteUploadedFile,
  DOCUMENT_ATTACHMENT_EXTENSIONS,
  DOCUMENT_ATTACHMENT_MIME_TYPES,
  RECEIPT_EXTENSIONS,
  RECEIPT_MIME_TYPES,
  buildTenantReceiptUploadDir,
  buildTenantReceiptStoredPath,
  buildTenantScopedUploadDir,
  buildTenantScopedStoredPath,
  resolveUploadedFilePath,
  inferMimeTypeFromStoredFilename,
  buildSafeDownloadFilename,
} from '../services/file-upload.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';

const fleetReceiptRootDir = path.join(getEnv().uploadDir, 'fleet_receipts');
const fleetDocumentRootDir = path.join(getEnv().uploadDir, 'fleet_documents');

function renderApp(c: any, subtitle: string, content: any, status: 200 | 400 | 404 = 200) {
  return c.html(
    <AppLayout
      currentTenant={c.get('tenant')}
      currentSubdomain={c.get('subdomain')}
      currentUser={c.get('user')}
      appName={process.env.APP_NAME || 'Hudson Business Solutions'}
      appLogo={process.env.APP_LOGO || '/static/brand/hudson-business-solutions-logo.png'}
      path={c.req.path}
      csrfToken={c.get('csrfToken')}
      subtitle={subtitle}
    >
      {content}
    </AppLayout>,
    status as any,
  );
}

function parsePositiveInt(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalInt(value: unknown, label: string): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be a whole number.`);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be 0 or greater.`);
  return parsed;
}

function parseOptionalYear(value: unknown): number | null {
  const parsed = parseOptionalInt(value, 'Year');
  if (parsed === null) return null;
  if (parsed < 1900 || parsed > 2100) throw new Error('Year must be between 1900 and 2100.');
  return parsed;
}

function parsePositiveMoney(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${fieldLabel} is required.`);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`${fieldLabel} must be a valid number with up to 2 decimal places.`);
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${fieldLabel} must be greater than 0.`);
  return Number(parsed.toFixed(2));
}

function parseOptionalDecimal(value: unknown, fieldLabel: string, maxDecimals = 3): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const regex = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);
  if (!regex.test(raw)) throw new Error(`${fieldLabel} must be a valid number.`);
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${fieldLabel} must be 0 or greater.`);
  return parsed;
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

function requireDate(value: unknown, fieldLabel: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${fieldLabel} is required.`);
  if (!isRealIsoDate(raw)) throw new Error(`${fieldLabel} must be a valid date.`);
  return raw;
}

function requireText(value: unknown, fieldLabel: string, maxLength: number): string {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error(`${fieldLabel} is required.`);
  if (raw.length > maxLength) throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  return raw;
}

function optionalText(value: unknown, fieldLabel: string, maxLength: number): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (raw.length > maxLength) throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  return raw;
}

function normalizeMaintenanceCategory(value: unknown): fleet.FleetMaintenanceCategory | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if ((fleet.FLEET_MAINTENANCE_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as fleet.FleetMaintenanceCategory;
  }
  throw new Error('Maintenance category is invalid.');
}

function buildVehicleFormData(source: Record<string, unknown>) {
  return {
    display_name: String(source.display_name ?? ''),
    unit_number: String(source.unit_number ?? ''),
    year: String(source.year ?? ''),
    make: String(source.make ?? ''),
    model: String(source.model ?? ''),
    license_plate: String(source.license_plate ?? ''),
    vin: String(source.vin ?? ''),
    active: String(source.active ?? '1'),
    notes: String(source.notes ?? ''),
  };
}

function buildRecordFormData(source: Record<string, unknown>, defaults?: { entry_date?: string; vehicle_id?: string }) {
  return {
    vehicle_id: String(source.vehicle_id ?? defaults?.vehicle_id ?? ''),
    entry_type: String(source.entry_type ?? 'fuel'),
    entry_date: String(source.entry_date ?? defaults?.entry_date ?? new Date().toISOString().slice(0, 10)),
    vendor: String(source.vendor ?? ''),
    amount: String(source.amount ?? ''),
    odometer: String(source.odometer ?? ''),
    gallons: String(source.gallons ?? ''),
    service_type: String(source.service_type ?? ''),
    maintenance_category: String(source.maintenance_category ?? ''),
    notes: String(source.notes ?? ''),
    remove_receipt: String(source.remove_receipt ?? ''),
  };
}

function buildFilters(c: any): fleet.FleetFilters {
  return {
    vehicleId: parsePositiveInt(c.req.query('vehicleId')),
    entryType: (['fuel', 'maintenance', 'all'].includes(String(c.req.query('entryType') || 'all')) ? String(c.req.query('entryType') || 'all') : 'all') as 'fuel' | 'maintenance' | 'all',
    archived: (['active', 'archived', 'all'].includes(String(c.req.query('archived') || 'all')) ? String(c.req.query('archived') || 'all') : 'all') as 'active' | 'archived' | 'all',
    search: String(c.req.query('search') || '').trim(),
    maintenanceCategory: ((String(c.req.query('maintenanceCategory') || 'all') === 'all' || (fleet.FLEET_MAINTENANCE_CATEGORIES as readonly string[]).includes(String(c.req.query('maintenanceCategory') || ''))) ? String(c.req.query('maintenanceCategory') || 'all') : 'all') as fleet.FleetMaintenanceCategory | 'all',
    dateFrom: isRealIsoDate(String(c.req.query('dateFrom') || '')) ? String(c.req.query('dateFrom')) : undefined,
    dateTo: isRealIsoDate(String(c.req.query('dateTo') || '')) ? String(c.req.query('dateTo')) : undefined,
  };
}

function buildFilterFormValues(filters: fleet.FleetFilters) {
  return {
    vehicle_id: filters.vehicleId ? String(filters.vehicleId) : '',
    entry_type: filters.entryType || 'all',
    archived: filters.archived || 'all',
    maintenance_category: filters.maintenanceCategory || 'all',
    date_from: filters.dateFrom || '',
    date_to: filters.dateTo || '',
    search: filters.search || '',
  };
}

function loadPageData(db: any, tenantId: number, filters: fleet.FleetFilters) {
  const vehicles = fleet.listVehiclesByTenant(db, tenantId, true);
  const entries = fleet.listEntriesByTenant(db, tenantId, true, filters);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const summary = fleet.summarizeByTenant(db, tenantId, monthStart, monthEnd);
  const reminderSettings = fleet.getFleetReminderSettings(db, tenantId);

  const dueReminders: Array<{ vehicleId: number; vehicleName: string; label: string; reason: string; isDue: boolean }> = [];
  for (const vehicle of vehicles.filter((row) => !row.archived_at)) {
    const vehicleSummary = fleet.summarizeVehicleById(db, tenantId, vehicle.id);
    const reminders = fleet.getVehicleReminderStatuses(db, tenantId, vehicle.id, reminderSettings, vehicleSummary.latestOdometer);
    reminders.filter((item) => item.isDue).forEach((item) => {
      dueReminders.push({
        vehicleId: vehicle.id,
        vehicleName: vehicle.display_name,
        label: item.label,
        reason: item.reason,
        isDue: item.isDue,
      });
    });
  }

  return { vehicles, entries, summary, dueReminders };
}

function maintenanceCategoryOptions() {
  return fleet.FLEET_MAINTENANCE_CATEGORIES.map((value) => ({
    value,
    label: fleet.getMaintenanceCategoryLabel(value),
  }));
}

function renderList(
  c: any,
  options?: {
    error?: string;
    success?: string;
    vehicleFormData?: ReturnType<typeof buildVehicleFormData>;
    recordFormData?: ReturnType<typeof buildRecordFormData>;
    editingVehicleId?: number | null;
    editingEntryId?: number | null;
    editingEntry?: { id: number; receipt_filename: string | null } | null;
  },
  status: 200 | 400 = 200,
) {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const db = getDb();
  const filters = buildFilters(c);
  const { vehicles, entries, summary, dueReminders } = loadPageData(db, tenantId, filters);
  const defaultDate = new Date().toISOString().slice(0, 10);

  return renderApp(
    c,
    'Fleet',
    <FleetPage
      vehicles={vehicles}
      entries={entries}
      summary={summary}
      dueReminders={dueReminders}
      filters={buildFilterFormValues(filters)}
      maintenanceCategoryOptions={maintenanceCategoryOptions()}
      vehicleFormData={options?.vehicleFormData || buildVehicleFormData({})}
      recordFormData={options?.recordFormData || buildRecordFormData({}, { entry_date: defaultDate })}
      editingVehicleId={options?.editingVehicleId || null}
      editingEntryId={options?.editingEntryId || null}
      editingEntry={options?.editingEntry || null}
      error={options?.error}
      success={options?.success}
      csrfToken={c.get('csrfToken')}
      canManage={userHasPermission(currentUser, 'fleet.manage')}
    />,
    status,
  );
}

async function maybeSaveReceipt(tenantId: number, uploadedReceipt: unknown): Promise<string | null> {
  if (!(uploadedReceipt instanceof File) || uploadedReceipt.size <= 0) {
    return null;
  }

  const tenantUploadDir = buildTenantReceiptUploadDir(fleetReceiptRootDir, tenantId);
  const filename = await saveUploadedFile(uploadedReceipt, tenantUploadDir, {
    allowedExtensions: RECEIPT_EXTENSIONS,
    allowedMimeTypes: RECEIPT_MIME_TYPES,
    maxBytes: getEnv().maxUploadBytes,
  });

  return buildTenantReceiptStoredPath(tenantId, filename);
}

async function maybeSaveDocument(
  tenantId: number,
  uploadedDocument: unknown,
): Promise<{ storedFilename: string; originalFilename: string } | null> {
  if (!(uploadedDocument instanceof File) || uploadedDocument.size <= 0) {
    return null;
  }

  const tenantUploadDir = buildTenantScopedUploadDir(fleetDocumentRootDir, tenantId);
  const filename = await saveUploadedFile(uploadedDocument, tenantUploadDir, {
    allowedExtensions: DOCUMENT_ATTACHMENT_EXTENSIONS,
    allowedMimeTypes: DOCUMENT_ATTACHMENT_MIME_TYPES,
    maxBytes: getEnv().maxUploadBytes,
  });

  return {
    storedFilename: buildTenantScopedStoredPath(tenantId, filename),
    originalFilename: uploadedDocument.name || filename,
  };
}

function csvEscape(value: unknown): string {
  const stringValue = String(value ?? '');
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export const fleetRoutes = new Hono<AppEnv>();

fleetRoutes.get('/fleet', permissionRequired('fleet.view'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const db = getDb();
  const editVehicleId = parsePositiveInt(c.req.query('editVehicle'));
  const editEntryId = parsePositiveInt(c.req.query('editEntry'));
  const preselectedVehicleId = parsePositiveInt(c.req.query('vehicleId'));

  if (editVehicleId) {
    const vehicle = fleet.findVehicleById(db, editVehicleId, tenantId);
    if (!vehicle) {
      return renderList(c, { error: 'Vehicle not found.' }, 400);
    }

    return renderList(c, {
      editingVehicleId: vehicle.id,
      vehicleFormData: buildVehicleFormData(vehicle as unknown as Record<string, unknown>),
      recordFormData: buildRecordFormData({}, {
        entry_date: new Date().toISOString().slice(0, 10),
        vehicle_id: preselectedVehicleId ? String(preselectedVehicleId) : '',
      }),
    });
  }

  if (editEntryId) {
    const entry = fleet.findEntryById(db, editEntryId, tenantId);
    if (!entry) {
      return renderList(c, { error: 'Fleet record not found.' }, 400);
    }

    return renderList(c, {
      editingEntryId: entry.id,
      editingEntry: { id: entry.id, receipt_filename: entry.receipt_filename },
      recordFormData: buildRecordFormData(entry as unknown as Record<string, unknown>),
      vehicleFormData: buildVehicleFormData({}),
    });
  }

  return renderList(c, {
    recordFormData: buildRecordFormData({}, {
      entry_date: new Date().toISOString().slice(0, 10),
      vehicle_id: preselectedVehicleId ? String(preselectedVehicleId) : '',
    }),
  });
});

fleetRoutes.get('/fleet/export.csv', permissionRequired('fleet.view'), (c) => {
  const tenant = c.get('tenant');
  const db = getDb();
  const filters = buildFilters(c);
  const entries = fleet.listEntriesByTenant(db, tenant!.id, true, filters);
  const rows = [
    ['Date', 'Type', 'Vehicle', 'Unit Number', 'Vendor', 'Amount', 'Odometer', 'Gallons', 'Service Type', 'Maintenance Category', 'Archived', 'Notes'],
    ...entries.map((entry) => [
      entry.entry_date,
      entry.entry_type,
      entry.vehicle_display_name,
      entry.vehicle_unit_number || '',
      entry.vendor || '',
      entry.amount.toFixed(2),
      entry.odometer ?? '',
      entry.gallons ?? '',
      entry.service_type || '',
      fleet.getMaintenanceCategoryLabel(entry.maintenance_category),
      entry.archived_at ? 'Yes' : 'No',
      entry.notes || '',
    ]),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="fleet-report-${tenant!.subdomain}.csv"`);
  return c.body(csv);
});


fleetRoutes.get('/fleet/schedule', permissionRequired('fleet.view'), (c) => {
  const tenant = c.get('tenant');
  const db = getDb();
  const rows = fleet.listFleetScheduleRows(db, tenant!.id, 30);

  return renderApp(
    c,
    'Fleet Schedule',
    <FleetSchedulePage
      rows={rows}
      getDocumentTypeLabel={fleet.getFleetDocumentTypeLabel}
    />,
  );
});

fleetRoutes.get('/fleet/vehicles/:id', permissionRequired('fleet.view'), (c) => {
  const tenant = c.get('tenant');
  const db = getDb();
  const vehicleId = parsePositiveInt(c.req.param('id'));
  if (!vehicleId) {
    return c.text('Vehicle not found', 404);
  }

  const vehicle = fleet.findVehicleById(db, vehicleId, tenant!.id);
  if (!vehicle) {
    return c.text('Vehicle not found', 404);
  }

  const summary = fleet.summarizeVehicleById(db, tenant!.id, vehicleId);
  const recentEntries = fleet.listEntriesForVehicle(db, tenant!.id, vehicleId, true, 25);
  const reminderSettings = fleet.getFleetReminderSettings(db, tenant!.id);
  const reminders = fleet.getVehicleReminderStatuses(db, tenant!.id, vehicleId, reminderSettings, summary.latestOdometer);
  const documents = fleet.listDocumentsForVehicle(db, tenant!.id, vehicleId, true);
  const attachmentHistory = fleet.listAttachmentHistoryForVehicle(db, tenant!.id, vehicleId, true, 50);

  return renderApp(
    c,
    vehicle.display_name,
    <FleetVehicleDetailPage
      vehicle={vehicle}
      summary={summary}
      recentEntries={recentEntries}
      reminders={reminders}
      documents={documents}
      attachmentHistory={attachmentHistory}
      csrfToken={c.get('csrfToken')}
      canManage={userHasPermission(c.get('user'), 'fleet.manage')}
      getCategoryLabel={fleet.getMaintenanceCategoryLabel}
      getDocumentTypeLabel={fleet.getFleetDocumentTypeLabel}
    />,
  );
});

fleetRoutes.post('/fleet/vehicles', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  try {
    const db = getDb();
    const vehicleId = fleet.createVehicle(db, tenant!.id, {
      display_name: requireText(body.display_name, 'Vehicle name', 120),
      unit_number: optionalText(body.unit_number, 'Unit number', 60),
      year: parseOptionalYear(body.year),
      make: optionalText(body.make, 'Make', 60),
      model: optionalText(body.model, 'Model', 60),
      license_plate: optionalText(body.license_plate, 'License plate', 40),
      vin: optionalText(body.vin, 'VIN', 40),
      active: String(body.active ?? '1') === '0' ? 0 : 1,
      notes: optionalText(body.notes, 'Notes', 2000),
    });

    await logActivity(db, {
      tenantId: tenant!.id,
      userId: c.get('user')?.id,
      action: 'fleet.vehicle_created',
      entityType: 'fleet_vehicle',
      entityId: vehicleId,
      summary: `Created fleet vehicle ${String(body.display_name ?? '').trim()}`,
      detailsJson: JSON.stringify({ vehicleId }),
      ipAddress: resolveRequestIp(c),
    });

    return renderList(c, { success: 'Vehicle added successfully.' });
  } catch (error) {
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to add vehicle.',
      vehicleFormData: buildVehicleFormData(body),
    }, 400);
  }
});

fleetRoutes.post('/fleet/vehicles/:id/update', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const vehicleId = parsePositiveInt(c.req.param('id'));
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  if (!vehicleId) return renderList(c, { error: 'Vehicle not found.' }, 400);

  try {
    const db = getDb();
    const vehicle = fleet.findVehicleById(db, vehicleId, tenant!.id);
    if (!vehicle) throw new Error('Vehicle not found.');

    fleet.updateVehicle(db, vehicleId, tenant!.id, {
      display_name: requireText(body.display_name, 'Vehicle name', 120),
      unit_number: optionalText(body.unit_number, 'Unit number', 60),
      year: parseOptionalYear(body.year),
      make: optionalText(body.make, 'Make', 60),
      model: optionalText(body.model, 'Model', 60),
      license_plate: optionalText(body.license_plate, 'License plate', 40),
      vin: optionalText(body.vin, 'VIN', 40),
      active: String(body.active ?? '1') === '0' ? 0 : 1,
      notes: optionalText(body.notes, 'Notes', 2000),
    });

    await logActivity(db, {
      tenantId: tenant!.id,
      userId: c.get('user')?.id,
      action: 'fleet.vehicle_updated',
      entityType: 'fleet_vehicle',
      entityId: vehicleId,
      summary: `Updated fleet vehicle ${String(body.display_name ?? '').trim()}`,
      detailsJson: JSON.stringify({ vehicleId }),
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect('/fleet');
  } catch (error) {
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to update vehicle.',
      editingVehicleId: vehicleId,
      vehicleFormData: buildVehicleFormData(body),
    }, 400);
  }
});

fleetRoutes.post('/fleet/vehicles/:id/archive', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const vehicleId = parsePositiveInt(c.req.param('id'));
  if (!vehicleId) return c.redirect('/fleet');
  const db = getDb();
  fleet.archiveVehicle(db, vehicleId, tenant!.id, c.get('user')!.id);
  return c.redirect('/fleet');
});

fleetRoutes.post('/fleet/vehicles/:id/restore', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const vehicleId = parsePositiveInt(c.req.param('id'));
  if (!vehicleId) return c.redirect('/fleet');
  const db = getDb();
  fleet.restoreVehicle(db, vehicleId, tenant!.id);
  return c.redirect('/fleet');
});

fleetRoutes.post('/fleet/entries', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  try {
    const db = getDb();
    const vehicleId = parsePositiveInt(body.vehicle_id);
    if (!vehicleId) throw new Error('Vehicle is required.');
    if (!fleet.findVehicleById(db, vehicleId, tenant!.id)) throw new Error('Vehicle not found.');

    const entryType = String(body.entry_type || 'fuel') === 'maintenance' ? 'maintenance' : 'fuel';
    const receiptFilename = await maybeSaveReceipt(tenant!.id, body.receipt);
    const entryId = fleet.createEntry(db, tenant!.id, {
      vehicle_id: vehicleId,
      entry_type: entryType,
      entry_date: requireDate(body.entry_date, 'Date'),
      vendor: optionalText(body.vendor, 'Vendor', 120),
      amount: parsePositiveMoney(body.amount, 'Amount'),
      odometer: parseOptionalInt(body.odometer, 'Odometer'),
      gallons: parseOptionalDecimal(body.gallons, 'Gallons', 3),
      service_type: optionalText(body.service_type, 'Service type', 120),
      maintenance_category: entryType === 'maintenance' ? normalizeMaintenanceCategory(body.maintenance_category) || 'other' : null,
      notes: optionalText(body.notes, 'Notes', 2000),
      receipt_filename: receiptFilename,
    });

    await logActivity(db, {
      tenantId: tenant!.id,
      userId: c.get('user')?.id,
      action: 'fleet.entry_created',
      entityType: 'fleet_entry',
      entityId: entryId,
      summary: `Created ${entryType} fleet record`,
      detailsJson: JSON.stringify({ entryId, vehicleId }),
      ipAddress: resolveRequestIp(c),
    });

    return renderList(c, { success: 'Fleet record added successfully.' });
  } catch (error) {
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to add fleet record.',
      recordFormData: buildRecordFormData(body),
    }, 400);
  }
});

fleetRoutes.post('/fleet/entries/:id/update', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const entryId = parsePositiveInt(c.req.param('id'));
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  if (!entryId) return renderList(c, { error: 'Fleet record not found.' }, 400);

  try {
    const db = getDb();
    const existingEntry = fleet.findEntryById(db, entryId, tenant!.id);
    if (!existingEntry) throw new Error('Fleet record not found.');

    const vehicleId = parsePositiveInt(body.vehicle_id);
    if (!vehicleId) throw new Error('Vehicle is required.');
    if (!fleet.findVehicleById(db, vehicleId, tenant!.id)) throw new Error('Vehicle not found.');

    const entryType = String(body.entry_type || 'fuel') === 'maintenance' ? 'maintenance' : 'fuel';
    let receiptFilename = existingEntry.receipt_filename;

    if (String(body.remove_receipt || '') === '1' && receiptFilename) {
      deleteUploadedFile(receiptFilename, fleetReceiptRootDir);
      receiptFilename = null;
    }

    const newReceiptFilename = await maybeSaveReceipt(tenant!.id, body.receipt);
    if (newReceiptFilename) {
      if (receiptFilename) {
        deleteUploadedFile(receiptFilename, fleetReceiptRootDir);
      }
      receiptFilename = newReceiptFilename;
    }

    fleet.updateEntry(db, entryId, tenant!.id, {
      vehicle_id: vehicleId,
      entry_type: entryType,
      entry_date: requireDate(body.entry_date, 'Date'),
      vendor: optionalText(body.vendor, 'Vendor', 120),
      amount: parsePositiveMoney(body.amount, 'Amount'),
      odometer: parseOptionalInt(body.odometer, 'Odometer'),
      gallons: parseOptionalDecimal(body.gallons, 'Gallons', 3),
      service_type: optionalText(body.service_type, 'Service type', 120),
      maintenance_category: entryType === 'maintenance' ? normalizeMaintenanceCategory(body.maintenance_category) || 'other' : null,
      notes: optionalText(body.notes, 'Notes', 2000),
      receipt_filename: receiptFilename,
    });

    await logActivity(db, {
      tenantId: tenant!.id,
      userId: c.get('user')?.id,
      action: 'fleet.entry_updated',
      entityType: 'fleet_entry',
      entityId: entryId,
      summary: `Updated ${entryType} fleet record`,
      detailsJson: JSON.stringify({ entryId, vehicleId }),
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect('/fleet');
  } catch (error) {
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to update fleet record.',
      editingEntryId: entryId,
      editingEntry: { id: entryId, receipt_filename: null },
      recordFormData: buildRecordFormData(body),
    }, 400);
  }
});

fleetRoutes.post('/fleet/entries/:id/archive', permissionRequired('fleet.manage'), (c) => {
  const tenant = c.get('tenant');
  const entryId = parsePositiveInt(c.req.param('id'));
  if (!entryId) return c.redirect('/fleet');
  const db = getDb();
  fleet.archiveEntry(db, entryId, tenant!.id, c.get('user')!.id);
  return c.redirect('/fleet');
});

fleetRoutes.post('/fleet/entries/:id/restore', permissionRequired('fleet.manage'), (c) => {
  const tenant = c.get('tenant');
  const entryId = parsePositiveInt(c.req.param('id'));
  if (!entryId) return c.redirect('/fleet');
  const db = getDb();
  fleet.restoreEntry(db, entryId, tenant!.id);
  return c.redirect('/fleet');
});

fleetRoutes.get('/fleet/entries/:id/receipt', permissionRequired('fleet.view'), (c) => {
  const tenant = c.get('tenant');
  const entryId = parsePositiveInt(c.req.param('id'));
  if (!entryId) return c.text('Receipt not found', 404);
  const db = getDb();
  const entry = fleet.findEntryById(db, entryId, tenant!.id);
  if (!entry?.receipt_filename) return c.text('Receipt not found', 404);

  const filePath = resolveUploadedFilePath(entry.receipt_filename, fleetReceiptRootDir);
  if (!fs.existsSync(filePath)) return c.text('Receipt not found', 404);

  c.header('Content-Type', inferMimeTypeFromStoredFilename(entry.receipt_filename));
  c.header('Content-Disposition', `inline; filename="${buildSafeDownloadFilename('fleet-receipt', entry.receipt_filename)}"`);
  return c.body(fs.readFileSync(filePath));
});

fleetRoutes.post('/fleet/documents', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  try {
    const db = getDb();
    const vehicleId = parsePositiveInt(body.vehicle_id);
    if (!vehicleId) throw new Error('Vehicle is required.');
    const vehicle = fleet.findVehicleById(db, vehicleId, tenant!.id);
    if (!vehicle) throw new Error('Vehicle not found.');

    const uploadedDocument = await maybeSaveDocument(tenant!.id, body.document);
    if (!uploadedDocument) throw new Error('Document file is required.');

    const documentTypeRaw = String(body.document_type || '').trim();
    if (!(fleet.FLEET_DOCUMENT_TYPES as readonly string[]).includes(documentTypeRaw)) {
      throw new Error('Document type is invalid.');
    }

    const expirationDateRaw = String(body.expiration_date || '').trim();
    const expirationDate = expirationDateRaw ? requireDate(expirationDateRaw, 'Expiration date') : null;

    const documentId = fleet.createDocument(db, tenant!.id, {
      vehicle_id: vehicleId,
      document_type: documentTypeRaw as fleet.FleetDocumentType,
      title: requireText(body.title, 'Title', 160),
      file_filename: uploadedDocument.storedFilename,
      original_filename: uploadedDocument.originalFilename,
      expiration_date: expirationDate,
      notes: optionalText(body.notes, 'Notes', 2000),
    });

    await logActivity(db, {
      tenantId: tenant!.id,
      userId: c.get('user')?.id,
      action: 'fleet.document_created',
      entityType: 'fleet_document',
      entityId: documentId,
      summary: `Uploaded fleet document for ${vehicle.display_name}`,
      detailsJson: JSON.stringify({ documentId, vehicleId }),
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/fleet/vehicles/${vehicleId}`);
  } catch (error) {
    return renderList(c, { error: error instanceof Error ? error.message : 'Unable to upload fleet document.' }, 400);
  }
});

fleetRoutes.post('/fleet/documents/:id/archive', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const documentId = parsePositiveInt(c.req.param('id'));
  if (!documentId) return c.redirect('/fleet');
  const db = getDb();
  const document = fleet.findDocumentById(db, documentId, tenant!.id);
  if (!document) return c.redirect('/fleet');
  fleet.archiveDocument(db, documentId, tenant!.id, c.get('user')!.id);
  return c.redirect(`/fleet/vehicles/${document.vehicle_id}`);
});

fleetRoutes.post('/fleet/documents/:id/restore', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const documentId = parsePositiveInt(c.req.param('id'));
  if (!documentId) return c.redirect('/fleet');
  const db = getDb();
  const document = fleet.findDocumentById(db, documentId, tenant!.id);
  if (!document) return c.redirect('/fleet');
  fleet.restoreDocument(db, documentId, tenant!.id);
  return c.redirect(`/fleet/vehicles/${document.vehicle_id}`);
});

fleetRoutes.get('/fleet/documents/:id/file', permissionRequired('fleet.view'), (c) => {
  const tenant = c.get('tenant');
  const documentId = parsePositiveInt(c.req.param('id'));
  if (!documentId) return c.text('Document not found', 404);
  const db = getDb();
  const document = fleet.findDocumentById(db, documentId, tenant!.id);
  if (!document?.file_filename) return c.text('Document not found', 404);

  const filePath = resolveUploadedFilePath(document.file_filename, fleetDocumentRootDir);
  if (!fs.existsSync(filePath)) return c.text('Document not found', 404);

  c.header('Content-Type', inferMimeTypeFromStoredFilename(document.file_filename));
  c.header('Content-Disposition', `inline; filename="${buildSafeDownloadFilename('fleet-document', document.file_filename)}"`);
  return c.body(fs.readFileSync(filePath));
});
