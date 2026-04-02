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
import { getEnv } from '../config/env.js';
import {
  saveUploadedFile,
  deleteUploadedFile,
  RECEIPT_EXTENSIONS,
  RECEIPT_MIME_TYPES,
  buildTenantReceiptUploadDir,
  buildTenantReceiptStoredPath,
  resolveUploadedFilePath,
  inferMimeTypeFromStoredFilename,
  buildSafeDownloadFilename,
} from '../services/file-upload.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';

const fleetReceiptRootDir = path.join(getEnv().uploadDir, 'fleet_receipts');

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
    notes: String(source.notes ?? ''),
    remove_receipt: String(source.remove_receipt ?? ''),
  };
}

function loadPageData(db: any, tenantId: number) {
  const vehicles = fleet.listVehiclesByTenant(db, tenantId, true);
  const entries = fleet.listEntriesByTenant(db, tenantId, true);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const summary = fleet.summarizeByTenant(db, tenantId, monthStart, monthEnd);
  return { vehicles, entries, summary };
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
  },
  status: 200 | 400 = 200,
) {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const db = getDb();
  const { vehicles, entries, summary } = loadPageData(db, tenantId);
  const defaultDate = new Date().toISOString().slice(0, 10);

  return renderApp(
    c,
    'Fleet',
    <FleetPage
      vehicles={vehicles}
      entries={entries}
      summary={summary}
      vehicleFormData={options?.vehicleFormData || buildVehicleFormData({})}
      recordFormData={options?.recordFormData || buildRecordFormData({}, { entry_date: defaultDate })}
      editingVehicleId={options?.editingVehicleId || null}
      editingEntryId={options?.editingEntryId || null}
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
    if (!vehicle) return renderList(c, { error: 'Vehicle not found.' }, 400);
    return renderList(c, {
      success: c.req.query('success') || undefined,
      editingVehicleId: vehicle.id,
      vehicleFormData: buildVehicleFormData(vehicle as unknown as Record<string, unknown>),
    });
  }

  if (editEntryId) {
    const entry = fleet.findEntryById(db, editEntryId, tenantId);
    if (!entry) return renderList(c, { error: 'Fleet record not found.' }, 400);
    return renderList(c, {
      success: c.req.query('success') || undefined,
      editingEntryId: entry.id,
      recordFormData: buildRecordFormData(entry as unknown as Record<string, unknown>),
    });
  }

  if (preselectedVehicleId) {
    const vehicle = fleet.findVehicleById(db, preselectedVehicleId, tenantId);
    if (!vehicle) return renderList(c, { error: 'Vehicle not found.' }, 400);
    return renderList(c, {
      success: c.req.query('success') || undefined,
      recordFormData: buildRecordFormData({}, { entry_date: new Date().toISOString().slice(0, 10), vehicle_id: String(vehicle.id) }),
    });
  }

  return renderList(c, { success: c.req.query('success') || undefined });
});

fleetRoutes.get('/fleet/vehicles/:id', permissionRequired('fleet.view'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const vehicleId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  if (!vehicleId) return c.text('Vehicle not found', 404);

  const vehicle = fleet.findVehicleById(db, vehicleId, tenantId);
  if (!vehicle) return c.text('Vehicle not found', 404);

  const summary = fleet.summarizeVehicleById(db, tenantId, vehicleId);
  const recentEntries = fleet.listEntriesForVehicle(db, tenantId, vehicleId, true, 25);

  return renderApp(
    c,
    'Fleet Vehicle Detail',
    <FleetVehicleDetailPage
      vehicle={vehicle}
      summary={summary}
      recentEntries={recentEntries}
      csrfToken={c.get('csrfToken')}
      canManage={userHasPermission(c.get('user'), 'fleet.manage')}
    />,
  );
});

fleetRoutes.post('/fleet/vehicles', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  try {
    const displayName = requireText(body.display_name, 'Display name', 120);
    const unitNumber = optionalText(body.unit_number, 'Unit number', 40);
    const year = parseOptionalYear(body.year);
    const make = optionalText(body.make, 'Make', 80);
    const model = optionalText(body.model, 'Model', 80);
    const licensePlate = optionalText(body.license_plate, 'License plate', 40);
    const vin = optionalText(body.vin, 'VIN', 40);
    const active = String(body.active ?? '1') === '0' ? 0 : 1;
    const notes = optionalText(body.notes, 'Notes', 600);

    const vehicleId = fleet.createVehicle(db, tenantId, {
      display_name: displayName,
      unit_number: unitNumber,
      year,
      make,
      model,
      license_plate: licensePlate,
      vin,
      active,
      notes,
    });

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id || null,
      eventType: 'fleet.vehicle.created',
      entityType: 'fleet_vehicle',
      entityId: vehicleId,
      description: `Created fleet vehicle ${displayName}.`,
      metadata: { display_name: displayName, unit_number: unitNumber },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect('/fleet?success=Vehicle%20added');
  } catch (error) {
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to save vehicle.',
      vehicleFormData: buildVehicleFormData(body),
    }, 400);
  }
});

fleetRoutes.post('/fleet/vehicles/:id/update', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const vehicleId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  if (!vehicleId) return renderList(c, { error: 'Vehicle not found.' }, 400);

  const existing = fleet.findVehicleById(db, vehicleId, tenantId);
  if (!existing) return renderList(c, { error: 'Vehicle not found.' }, 400);

  try {
    const displayName = requireText(body.display_name, 'Display name', 120);
    const unitNumber = optionalText(body.unit_number, 'Unit number', 40);
    const year = parseOptionalYear(body.year);
    const make = optionalText(body.make, 'Make', 80);
    const model = optionalText(body.model, 'Model', 80);
    const licensePlate = optionalText(body.license_plate, 'License plate', 40);
    const vin = optionalText(body.vin, 'VIN', 40);
    const active = String(body.active ?? '1') === '0' ? 0 : 1;
    const notes = optionalText(body.notes, 'Notes', 600);

    fleet.updateVehicle(db, vehicleId, tenantId, {
      display_name: displayName,
      unit_number: unitNumber,
      year,
      make,
      model,
      license_plate: licensePlate,
      vin,
      active,
      notes,
    });

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id || null,
      eventType: 'fleet.vehicle.updated',
      entityType: 'fleet_vehicle',
      entityId: vehicleId,
      description: `Updated fleet vehicle ${displayName}.`,
      metadata: { previous_display_name: existing.display_name, display_name: displayName },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/fleet/vehicles/${vehicleId}`);
  } catch (error) {
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to update vehicle.',
      editingVehicleId: vehicleId,
      vehicleFormData: buildVehicleFormData(body),
    }, 400);
  }
});

fleetRoutes.post('/fleet/vehicles/:id/archive', permissionRequired('fleet.manage'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const vehicleId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  if (!vehicleId) return c.text('Vehicle not found', 404);
  const existing = fleet.findVehicleById(db, vehicleId, tenantId);
  if (!existing) return c.text('Vehicle not found', 404);
  if (!existing.archived_at) {
    fleet.archiveVehicle(db, vehicleId, tenantId, currentUser!.id);
    logActivity(db, {
      tenantId,
      actorUserId: currentUser!.id,
      eventType: 'fleet.vehicle.archived',
      entityType: 'fleet_vehicle',
      entityId: vehicleId,
      description: `Archived fleet vehicle ${existing.display_name}.`,
      ipAddress: resolveRequestIp(c),
    });
  }
  return c.redirect('/fleet?success=Vehicle%20archived');
});

fleetRoutes.post('/fleet/vehicles/:id/restore', permissionRequired('fleet.manage'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const vehicleId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  if (!vehicleId) return c.text('Vehicle not found', 404);
  const existing = fleet.findVehicleById(db, vehicleId, tenantId);
  if (!existing) return c.text('Vehicle not found', 404);
  if (existing.archived_at) {
    fleet.restoreVehicle(db, vehicleId, tenantId);
    logActivity(db, {
      tenantId,
      actorUserId: currentUser!.id,
      eventType: 'fleet.vehicle.restored',
      entityType: 'fleet_vehicle',
      entityId: vehicleId,
      description: `Restored fleet vehicle ${existing.display_name}.`,
      ipAddress: resolveRequestIp(c),
    });
  }
  return c.redirect(`/fleet/vehicles/${vehicleId}`);
});

fleetRoutes.post('/fleet/entries', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  let receiptFilename: string | null = null;

  try {
    const vehicleId = parsePositiveInt(body.vehicle_id);
    if (!vehicleId) throw new Error('Vehicle is required.');

    const vehicle = fleet.findVehicleById(db, vehicleId, tenantId);
    if (!vehicle || vehicle.archived_at) throw new Error('Selected vehicle is not available.');

    const entryType = String(body.entry_type ?? 'fuel') === 'maintenance' ? 'maintenance' : 'fuel';
    const entryDate = requireDate(body.entry_date, 'Date');
    const vendor = optionalText(body.vendor, 'Vendor', 120);
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const odometer = parseOptionalInt(body.odometer, 'Odometer');
    const gallons = parseOptionalDecimal(body.gallons, 'Gallons');
    const serviceType = optionalText(body.service_type, 'Service type', 120);
    const notes = optionalText(body.notes, 'Notes', 1000);

    if (entryType === 'fuel' && gallons !== null && gallons <= 0) {
      throw new Error('Gallons must be greater than 0 when provided.');
    }

    receiptFilename = await maybeSaveReceipt(tenantId, body.receipt);

    const entryId = fleet.createEntry(db, tenantId, {
      vehicle_id: vehicleId,
      entry_type: entryType,
      entry_date: entryDate,
      vendor,
      amount,
      odometer,
      gallons: entryType === 'fuel' ? gallons : null,
      service_type: entryType === 'maintenance' ? serviceType : null,
      notes,
      receipt_filename: receiptFilename,
    });

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id || null,
      eventType: `fleet.entry.${entryType}.created`,
      entityType: 'fleet_entry',
      entityId: entryId,
      description: `Added ${entryType} record for ${vehicle.display_name}.`,
      metadata: { vehicle_id: vehicleId, amount, vendor },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/fleet/vehicles/${vehicleId}`);
  } catch (error) {
    if (receiptFilename) deleteUploadedFile(receiptFilename, fleetReceiptRootDir);
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to save fleet record.',
      recordFormData: buildRecordFormData(body),
    }, 400);
  }
});

fleetRoutes.post('/fleet/entries/:id/update', permissionRequired('fleet.manage'), async (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const entryId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  if (!entryId) return renderList(c, { error: 'Fleet record not found.' }, 400);
  const existing = fleet.findEntryById(db, entryId, tenantId);
  if (!existing) return renderList(c, { error: 'Fleet record not found.' }, 400);

  let nextReceiptFilename = existing.receipt_filename;
  let uploadedReplacement: string | null = null;

  try {
    const vehicleId = parsePositiveInt(body.vehicle_id);
    if (!vehicleId) throw new Error('Vehicle is required.');

    const vehicle = fleet.findVehicleById(db, vehicleId, tenantId);
    if (!vehicle || vehicle.archived_at) throw new Error('Selected vehicle is not available.');

    const entryType = String(body.entry_type ?? 'fuel') === 'maintenance' ? 'maintenance' : 'fuel';
    const entryDate = requireDate(body.entry_date, 'Date');
    const vendor = optionalText(body.vendor, 'Vendor', 120);
    const amount = parsePositiveMoney(body.amount, 'Amount');
    const odometer = parseOptionalInt(body.odometer, 'Odometer');
    const gallons = parseOptionalDecimal(body.gallons, 'Gallons');
    const serviceType = optionalText(body.service_type, 'Service type', 120);
    const notes = optionalText(body.notes, 'Notes', 1000);
    const removeReceipt = String(body.remove_receipt ?? '') === '1';

    if (entryType === 'fuel' && gallons !== null && gallons <= 0) {
      throw new Error('Gallons must be greater than 0 when provided.');
    }

    uploadedReplacement = await maybeSaveReceipt(tenantId, body.receipt);
    if (uploadedReplacement) {
      nextReceiptFilename = uploadedReplacement;
    } else if (removeReceipt) {
      nextReceiptFilename = null;
    }

    fleet.updateEntry(db, entryId, tenantId, {
      vehicle_id: vehicleId,
      entry_type: entryType,
      entry_date: entryDate,
      vendor,
      amount,
      odometer,
      gallons: entryType === 'fuel' ? gallons : null,
      service_type: entryType === 'maintenance' ? serviceType : null,
      notes,
      receipt_filename: nextReceiptFilename,
    });

    if ((uploadedReplacement || removeReceipt) && existing.receipt_filename && existing.receipt_filename !== nextReceiptFilename) {
      deleteUploadedFile(existing.receipt_filename, fleetReceiptRootDir);
    }

    logActivity(db, {
      tenantId,
      actorUserId: currentUser?.id || null,
      eventType: 'fleet.entry.updated',
      entityType: 'fleet_entry',
      entityId: entryId,
      description: `Updated ${entryType} fleet record for ${vehicle.display_name}.`,
      metadata: { vehicle_id: vehicleId, amount, vendor },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect(`/fleet/vehicles/${vehicleId}`);
  } catch (error) {
    if (uploadedReplacement) deleteUploadedFile(uploadedReplacement, fleetReceiptRootDir);
    return renderList(c, {
      error: error instanceof Error ? error.message : 'Unable to update fleet record.',
      editingEntryId: entryId,
      recordFormData: buildRecordFormData(body),
    }, 400);
  }
});

fleetRoutes.post('/fleet/entries/:id/archive', permissionRequired('fleet.manage'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const entryId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  if (!entryId) return c.text('Fleet record not found', 404);
  const existing = fleet.findEntryById(db, entryId, tenantId);
  if (!existing) return c.text('Fleet record not found', 404);
  if (!existing.archived_at) {
    fleet.archiveEntry(db, entryId, tenantId, currentUser!.id);
    logActivity(db, {
      tenantId,
      actorUserId: currentUser!.id,
      eventType: 'fleet.entry.archived',
      entityType: 'fleet_entry',
      entityId: entryId,
      description: `Archived ${existing.entry_type} fleet record for ${existing.vehicle_display_name}.`,
      ipAddress: resolveRequestIp(c),
    });
  }
  return c.redirect(`/fleet/vehicles/${existing.vehicle_id}`);
});

fleetRoutes.post('/fleet/entries/:id/restore', permissionRequired('fleet.manage'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const currentUser = c.get('user');
  const entryId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  if (!entryId) return c.text('Fleet record not found', 404);
  const existing = fleet.findEntryById(db, entryId, tenantId);
  if (!existing) return c.text('Fleet record not found', 404);
  if (existing.archived_at) {
    fleet.restoreEntry(db, entryId, tenantId);
    logActivity(db, {
      tenantId,
      actorUserId: currentUser!.id,
      eventType: 'fleet.entry.restored',
      entityType: 'fleet_entry',
      entityId: entryId,
      description: `Restored ${existing.entry_type} fleet record for ${existing.vehicle_display_name}.`,
      ipAddress: resolveRequestIp(c),
    });
  }
  return c.redirect(`/fleet/vehicles/${existing.vehicle_id}`);
});

fleetRoutes.get('/fleet/entries/:id/receipt', permissionRequired('fleet.view'), (c) => {
  const tenant = c.get('tenant');
  const tenantId = tenant!.id;
  const entryId = parsePositiveInt(c.req.param('id'));
  const db = getDb();
  if (!entryId) return c.text('Fleet record not found', 404);
  const entry = fleet.findEntryById(db, entryId, tenantId);
  if (!entry || !entry.receipt_filename) return c.text('Receipt not found', 404);

  try {
    const filePath = resolveUploadedFilePath(entry.receipt_filename, fleetReceiptRootDir);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return c.text('Receipt not found', 404);

    const data = fs.readFileSync(filePath);
    const mimeType = inferMimeTypeFromStoredFilename(entry.receipt_filename);
    const downloadName = buildSafeDownloadFilename(`fleet-record-${entry.id}-receipt`, entry.receipt_filename);

    c.header('Content-Type', mimeType);
    c.header('Content-Length', String(data.byteLength));
    c.header('Content-Disposition', `inline; filename="${downloadName}"`);
    return c.body(data);
  } catch {
    return c.text('Receipt not found', 404);
  }
});
