import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as invoices from '../db/queries/invoices.js';
import { PublicLayout } from '../pages/layouts/PublicLayout.js';
import { PublicInvoicePage } from '../pages/invoices/PublicInvoicePage.js';
import { resolveRequestIp } from '../services/activity-log.js';

const appName = () => process.env.APP_NAME || 'Hudson Business Solutions';
const appLogo = () => process.env.APP_LOGO || '/static/brand/hudson-business-solutions-logo.png';

function getTenantBranding(db: any, tenantId: number) {
  return db.prepare(`
    SELECT name, logo_path FROM tenants WHERE id = ? LIMIT 1
  `).get(tenantId) as { name: string; logo_path: string | null } | undefined;
}

function renderMessage(
  c: any,
  opts: { title: string; heading: string; message: string; tone?: 'success' | 'danger' | 'default' },
  status: 200 | 404 = 200,
) {
  const accentStyle =
    opts.tone === 'success'
      ? 'border-color:#BBF7D0; background:#F0FDF4; color:#166534;'
      : opts.tone === 'danger'
        ? 'border-color:#FECACA; background:#FEF2F2; color:#991B1B;'
        : 'border-color:#BFDBFE; background:#EFF6FF; color:#1E3A8A;';

  return c.html(
    <PublicLayout appName={appName()} appLogo={appLogo()}>
      <div style="max-width:640px; margin:0 auto; display:grid; gap:16px;">
        <div class="page-head">
          <h1>{opts.heading}</h1>
        </div>
        <div class="card" style={accentStyle}>
          <div style="line-height:1.6;">{opts.message}</div>
        </div>
      </div>
    </PublicLayout>,
    status,
  );
}

export const publicInvoiceRoutes = new Hono<AppEnv>();

publicInvoiceRoutes.get('/invoice/view/:token', (c) => {
  const token = String(c.req.param('token') || '').trim();
  const db = getDb();

  if (!token) {
    return renderMessage(c, { title: 'Not Found', heading: 'Invoice link unavailable', message: 'This link is invalid. Please contact your contractor.', tone: 'danger' }, 404);
  }

  const inv = invoices.findByPublicToken(db, token);

  if (!inv || inv.archived_at) {
    return renderMessage(c, { title: 'Not Found', heading: 'Invoice not found', message: 'This invoice link is no longer valid. Please contact your contractor.', tone: 'danger' }, 404);
  }

  const tenant = getTenantBranding(db, inv.tenant_id);
  const logo = tenant?.logo_path || appLogo();

  return c.html(
    <PublicLayout appName={appName()} appLogo={logo}>
      <div style="max-width:760px; margin:0 auto;">
        <PublicInvoicePage
          companyName={tenant?.name || appName()}
          invoice={inv}
          csrfToken={c.get('csrfToken')}
        />
      </div>
    </PublicLayout>,
  );
});

publicInvoiceRoutes.post('/invoice/sign/:token', async (c) => {
  const token = String(c.req.param('token') || '').trim();
  const db = getDb();

  if (!token) {
    return renderMessage(c, { title: 'Not Found', heading: 'Invoice link unavailable', message: 'This link is invalid.', tone: 'danger' }, 404);
  }

  const inv = invoices.findByPublicToken(db, token);

  if (!inv || inv.archived_at) {
    return renderMessage(c, { title: 'Not Found', heading: 'Invoice not found', message: 'This invoice link is no longer valid.', tone: 'danger' }, 404);
  }

  const tenant = getTenantBranding(db, inv.tenant_id);

  if (inv.signed_at) {
    return renderMessage(c, {
      title: 'Already Signed',
      heading: 'Invoice already signed',
      message: 'This invoice has already been signed. No further action is required.',
      tone: 'default',
    });
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const signatureData = String(body.signature_data ?? '').trim();
  const signerName = String(body.signer_name ?? '').trim().slice(0, 200);

  if (!signatureData || !signatureData.startsWith('data:image/png;base64,')) {
    return renderMessage(c, {
      title: 'Signature Required',
      heading: 'Signature required',
      message: 'Please draw your signature before submitting.',
      tone: 'danger',
    });
  }

  invoices.recordSignature(db, inv.id, inv.tenant_id, {
    signature_data: signatureData,
    signer_name: signerName,
    signature_ip: resolveRequestIp(c) ?? '',
  });

  return renderMessage(c, {
    title: 'Signed',
    heading: 'Invoice signed successfully',
    message: `Thank you${signerName ? `, ${signerName}` : ''}. Your signature has been recorded for Invoice ${inv.invoice_number}. ${tenant?.name || 'Your contractor'} has been notified.`,
    tone: 'success',
  });
});

export default publicInvoiceRoutes;
