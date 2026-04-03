import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { permissionRequired, userHasPermission } from '../middleware/auth.js';
import {
  saveUploadedFile,
  LOGO_EXTENSIONS,
  LOGO_MIME_TYPES,
} from '../services/file-upload.js';
import { SettingsPage } from '../pages/settings/SettingsPage.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { getEnv } from '../config/env.js';

function renderApp(c: any, subtitle: string, content: any, status: 200 | 400 = 200) {
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

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidWebsite(value: string): boolean {
  if (!value) return true;
  try {
    const parsed = new URL(
      value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`,
    );
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function normalizeWebsite(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `https://${raw}`;
}

function normalizeInvoicePrefix(value: string): string {
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return '';
  if (!/^[A-Z0-9-]{1,12}$/.test(cleaned)) {
    throw new Error(
      'Invoice prefix may only contain letters, numbers, and dashes, up to 12 characters.',
    );
  }
  return cleaned;
}

function parseNonNegativeNumber(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a valid number with up to 2 decimal places.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} must be a valid number.`);
  }

  if (parsed < 0) {
    throw new Error(`${fieldLabel} cannot be negative.`);
  }

  return Number(parsed.toFixed(2));
}

function parsePercent(value: unknown, fieldLabel: string): number {
  const parsed = parseNonNegativeNumber(value, fieldLabel);

  if (parsed < 0 || parsed > 100) {
    throw new Error(`${fieldLabel} must be between 0 and 100.`);
  }

  return parsed;
}

function parseNonNegativeWholeNumber(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a whole number.`);
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be 0 or greater.`);
  }
  return parsed;
}

function normalizeTextarea(value: unknown, maxLength: number, fieldLabel: string): string {
  const parsed = String(value ?? '').replace(/\r/g, '').trim();
  if (!parsed) return '';
  if (parsed.length > maxLength) {
    throw new Error(`${fieldLabel} must be ${maxLength} characters or less.`);
  }
  return parsed;
}

function getTenantSettings(db: any, tenantId: number) {
  return db
    .prepare(
      `
    SELECT id, name, subdomain, logo_path, invoice_prefix,
           company_email, company_phone, company_address,
           company_website, proposal_license_info,
           proposal_default_terms, proposal_default_acknowledgment,
           default_tax_rate, default_labor_rate,
           fleet_oil_change_miles, fleet_oil_change_days,
           fleet_tire_rotation_miles, fleet_tire_rotation_days,
           fleet_inspection_days
    FROM tenants
    WHERE id = ?
  `,
    )
    .get(tenantId) as any;
}

function buildTenantFormValues(source: any) {
  return {
    id: Number(source?.id || 0),
    name: String(source?.name || ''),
    subdomain: String(source?.subdomain || ''),
    logo_path: source?.logo_path ? String(source.logo_path) : null,
    invoice_prefix: source?.invoice_prefix ? String(source.invoice_prefix) : '',
    company_email: source?.company_email ? String(source.company_email) : '',
    company_phone: source?.company_phone ? String(source.company_phone) : '',
    company_address: source?.company_address ? String(source.company_address) : '',
    company_website: source?.company_website ? String(source.company_website) : '',
    proposal_license_info: source?.proposal_license_info ? String(source.proposal_license_info) : '',
    proposal_default_terms: source?.proposal_default_terms ? String(source.proposal_default_terms) : '',
    proposal_default_acknowledgment: source?.proposal_default_acknowledgment ? String(source.proposal_default_acknowledgment) : '',
    default_tax_rate: Number(source?.default_tax_rate || 0),
    default_labor_rate: Number(source?.default_labor_rate || 0),
    fleet_oil_change_miles: Number(source?.fleet_oil_change_miles || 0),
    fleet_oil_change_days: Number(source?.fleet_oil_change_days || 0),
    fleet_tire_rotation_miles: Number(source?.fleet_tire_rotation_miles || 0),
    fleet_tire_rotation_days: Number(source?.fleet_tire_rotation_days || 0),
    fleet_inspection_days: Number(source?.fleet_inspection_days || 0),
  };
}

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.get('/settings', permissionRequired('settings.view'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const db = getDb();
  const tenantRow = getTenantSettings(db, tenant.id);

  if (!tenantRow) {
    return c.text('Tenant not found', 404);
  }

  return renderApp(
    c,
    'Company Settings',
    <SettingsPage
      tenant={buildTenantFormValues(tenantRow)}
      csrfToken={c.get('csrfToken')}
      canManageSettings={userHasPermission(c.get('user'), 'settings.manage')}
    />,
  );
});

settingsRoutes.post('/settings', permissionRequired('settings.manage'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const tenantId = tenant.id;
  const db = getDb();
  const env = getEnv();

  const tenantRow = getTenantSettings(db, tenantId);
  if (!tenantRow) {
    return c.text('Tenant not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;

  const formTenant = buildTenantFormValues({
    ...tenantRow,
    name: String(body.name ?? tenantRow.name ?? '').trim(),
    invoice_prefix: String(body.invoice_prefix ?? tenantRow.invoice_prefix ?? '').trim(),
    company_email: String(body.company_email ?? tenantRow.company_email ?? '').trim(),
    company_phone: String(body.company_phone ?? tenantRow.company_phone ?? '').trim(),
    company_address: String(body.company_address ?? tenantRow.company_address ?? '').trim(),
    company_website: String(body.company_website ?? tenantRow.company_website ?? '').trim(),
    proposal_license_info: String(body.proposal_license_info ?? tenantRow.proposal_license_info ?? '').trim(),
    proposal_default_terms: String(body.proposal_default_terms ?? tenantRow.proposal_default_terms ?? '').trim(),
    proposal_default_acknowledgment: String(body.proposal_default_acknowledgment ?? tenantRow.proposal_default_acknowledgment ?? '').trim(),
    default_tax_rate: String(body.default_tax_rate ?? tenantRow.default_tax_rate ?? '0'),
    default_labor_rate: String(body.default_labor_rate ?? tenantRow.default_labor_rate ?? '0'),
    fleet_oil_change_miles: String(body.fleet_oil_change_miles ?? tenantRow.fleet_oil_change_miles ?? '0'),
    fleet_oil_change_days: String(body.fleet_oil_change_days ?? tenantRow.fleet_oil_change_days ?? '0'),
    fleet_tire_rotation_miles: String(body.fleet_tire_rotation_miles ?? tenantRow.fleet_tire_rotation_miles ?? '0'),
    fleet_tire_rotation_days: String(body.fleet_tire_rotation_days ?? tenantRow.fleet_tire_rotation_days ?? '0'),
    fleet_inspection_days: String(body.fleet_inspection_days ?? tenantRow.fleet_inspection_days ?? '0'),
  });

  try {
    const name = String(body.name ?? '').trim();
    const companyEmail = String(body.company_email ?? '').trim();
    const companyPhone = String(body.company_phone ?? '').trim();
    const companyAddress = String(body.company_address ?? '').trim();
    const companyWebsiteRaw = String(body.company_website ?? '').trim();

    if (!name) {
      throw new Error('Company name is required.');
    }

    if (name.length > 120) {
      throw new Error('Company name must be 120 characters or less.');
    }

    if (companyEmail && !isValidEmail(companyEmail)) {
      throw new Error('Company email must be a valid email address.');
    }

    if (companyEmail.length > 255) {
      throw new Error('Company email must be 255 characters or less.');
    }

    if (companyPhone.length > 40) {
      throw new Error('Company phone must be 40 characters or less.');
    }

    if (companyAddress.length > 255) {
      throw new Error('Company address must be 255 characters or less.');
    }

    if (companyWebsiteRaw && !isValidWebsite(companyWebsiteRaw)) {
      throw new Error('Company website must be a valid URL or domain.');
    }

    const companyWebsite = normalizeWebsite(companyWebsiteRaw);
    const proposalLicenseInfo = normalizeTextarea(body.proposal_license_info, 1200, 'License / certification footer text');
    const proposalDefaultTerms = normalizeTextarea(body.proposal_default_terms, 8000, 'Default proposal terms');
    const proposalDefaultAcknowledgment = normalizeTextarea(body.proposal_default_acknowledgment, 4000, 'Default acknowledgment text');
    const invoicePrefix = normalizeInvoicePrefix(String(body.invoice_prefix ?? ''));
    const defaultTaxRate = parsePercent(body.default_tax_rate, 'Default tax rate');
    const defaultLaborRate = parseNonNegativeNumber(body.default_labor_rate, 'Default labor rate');
    const fleetOilChangeMiles = parseNonNegativeWholeNumber(body.fleet_oil_change_miles, 'Oil change miles');
    const fleetOilChangeDays = parseNonNegativeWholeNumber(body.fleet_oil_change_days, 'Oil change days');
    const fleetTireRotationMiles = parseNonNegativeWholeNumber(body.fleet_tire_rotation_miles, 'Tire rotation miles');
    const fleetTireRotationDays = parseNonNegativeWholeNumber(body.fleet_tire_rotation_days, 'Tire rotation days');
    const fleetInspectionDays = parseNonNegativeWholeNumber(body.fleet_inspection_days, 'Inspection days');

    let logoPath = tenantRow.logo_path;

    const file = body.logo;
    if (file && file instanceof File && file.name) {
      const uploadDir = `${process.env.UPLOAD_DIR ?? './data'}/tenant_logos`;
      const filename = await saveUploadedFile(file, uploadDir, {
        allowedExtensions: LOGO_EXTENSIONS,
        allowedMimeTypes: LOGO_MIME_TYPES,
        maxBytes: env.maxLogoUploadBytes,
        processingMode: 'logo',
      });

      logoPath = `/uploads/logos/${filename}`;
      formTenant.logo_path = logoPath;
    }

    db.prepare(
      `
      UPDATE tenants
      SET name = ?,
          logo_path = ?,
          invoice_prefix = ?,
          company_email = ?,
          company_phone = ?,
          company_address = ?,
          company_website = ?,
          proposal_license_info = ?,
          proposal_default_terms = ?,
          proposal_default_acknowledgment = ?,
          default_tax_rate = ?,
          default_labor_rate = ?,
          fleet_oil_change_miles = ?,
          fleet_oil_change_days = ?,
          fleet_tire_rotation_miles = ?,
          fleet_tire_rotation_days = ?,
          fleet_inspection_days = ?
      WHERE id = ?
    `,
    ).run(
      name,
      logoPath,
      invoicePrefix,
      companyEmail || null,
      companyPhone || null,
      companyAddress || null,
      companyWebsite || null,
      proposalLicenseInfo || null,
      proposalDefaultTerms || null,
      proposalDefaultAcknowledgment || null,
      defaultTaxRate,
      defaultLaborRate,
      fleetOilChangeMiles,
      fleetOilChangeDays,
      fleetTireRotationMiles,
      fleetTireRotationDays,
      fleetInspectionDays,
      tenantId,
    );

    const updatedTenantRow = getTenantSettings(db, tenantId);

    return renderApp(
      c,
      'Company Settings',
      <SettingsPage
        tenant={buildTenantFormValues(updatedTenantRow)}
        csrfToken={c.get('csrfToken')}
        success="Company settings updated successfully."
        canManageSettings={userHasPermission(c.get('user'), 'settings.manage')}
      />,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update settings.';
    return renderApp(
      c,
      'Company Settings',
      <SettingsPage
        tenant={formTenant}
        csrfToken={c.get('csrfToken')}
        error={message}
        canManageSettings={userHasPermission(c.get('user'), 'settings.manage')}
      />,
      400,
    );
  }
});
