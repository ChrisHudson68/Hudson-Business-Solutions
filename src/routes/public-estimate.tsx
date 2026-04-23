import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as estimates from '../db/queries/estimates.js';
import { PublicLayout } from '../pages/layouts/PublicLayout.js';
import { PublicEstimatePage } from '../pages/estimates/PublicEstimatePage.js';
import { resolveRequestIp } from '../services/activity-log.js';
import { convertApprovedEstimateToJob } from '../services/convert-estimate-to-job.js';

function buildPublicUrl(c: any, token: string): string {
  const requestUrl = new URL(c.req.url);
  return `${requestUrl.origin}/estimate/view/${token}`;
}

function renderPublicMessage(
  c: any,
  options: {
    title: string;
    heading: string;
    message: string;
    tone?: 'default' | 'success' | 'danger';
    estimateNumber?: string | null;
    companyName?: string;
    appName?: string;
    appLogo?: string;
  },
  status: 200 | 404 = 200,
) {
  const appName = options.appName || process.env.APP_NAME || 'Hudson Business Solutions';
  const appLogo =
    options.appLogo ||
    process.env.APP_LOGO ||
    '/static/brand/hudson-business-solutions-logo.png';

  const accentStyle =
    options.tone === 'success'
      ? 'border-color:#BBF7D0; background:#F0FDF4; color:#166534;'
      : options.tone === 'danger'
        ? 'border-color:#FECACA; background:#FEF2F2; color:#991B1B;'
        : 'border-color:#BFDBFE; background:#EFF6FF; color:#1E3A8A;';

  return c.html(
    <PublicLayout appName={appName} appLogo={appLogo}>
      <div style="max-width:760px; margin:0 auto; display:grid; gap:16px;">
        <div class="page-head">
          <h1>{options.heading}</h1>
          <p>{options.companyName || appName}</p>
        </div>

        <div class="card" style={accentStyle}>
          <div style="font-size:18px; font-weight:800; margin-bottom:8px;">
            {options.heading}
          </div>
          <div style="line-height:1.6;">{options.message}</div>
          {options.estimateNumber ? (
            <div style="margin-top:12px; font-weight:700;">
              Estimate: {options.estimateNumber}
            </div>
          ) : null}
        </div>

        <div class="card">
          <h3 style="margin-top:0;">What happens next</h3>
          <p class="muted" style="text-align:left; margin-bottom:0;">
            Your response has been recorded. The contractor can review the estimate inside their
            workspace and continue the next steps.
          </p>
        </div>
      </div>
    </PublicLayout>,
    status,
  );
}

function getTenantBranding(db: any, tenantId: number) {
  return db.prepare(`
    SELECT name, logo_path, subdomain
    FROM tenants
    WHERE id = ?
    LIMIT 1
  `).get(tenantId) as
    | {
        name: string;
        logo_path: string | null;
        subdomain: string;
      }
    | undefined;
}

export const publicEstimateRoutes = new Hono<AppEnv>();

publicEstimateRoutes.get('/estimate/view/:token', (c) => {
  const token = String(c.req.param('token') || '').trim();
  const db = getDb();

  if (!token) {
    return renderPublicMessage(
      c,
      {
        title: 'Estimate Not Found',
        heading: 'Estimate link unavailable',
        message:
          'This estimate link is invalid, incomplete, or no longer available. Please contact the contractor and ask them to resend your estimate link.',
        tone: 'danger',
      },
      404,
    );
  }

  const estimate = estimates.findByPublicToken(db, token);

  if (!estimate) {
    return renderPublicMessage(
      c,
      {
        title: 'Estimate Not Found',
        heading: 'Estimate link unavailable',
        message:
          'We could not find an estimate for this link. It may have expired or been replaced. Please contact the contractor for a new link.',
        tone: 'danger',
      },
      404,
    );
  }

  const fullEstimate = estimates.findWithLineItemsById(db, estimate.id, estimate.tenant_id);

  if (!fullEstimate) {
    return renderPublicMessage(
      c,
      {
        title: 'Estimate Not Found',
        heading: 'Estimate unavailable',
        message:
          'This estimate could not be loaded at this time. Please contact the contractor for assistance.',
        tone: 'danger',
      },
      404,
    );
  }

  const tenantRow = getTenantBranding(db, estimate.tenant_id);

  const appName = process.env.APP_NAME || 'Hudson Business Solutions';
  const appLogo =
    tenantRow?.logo_path ||
    process.env.APP_LOGO ||
    '/static/brand/hudson-business-solutions-logo.png';

  return c.html(
    <PublicLayout appName={appName} appLogo={appLogo}>
      <PublicEstimatePage
        appName={appName}
        appLogo={appLogo}
        companyName={tenantRow?.name || appName}
        estimate={fullEstimate}
        publicUrl={buildPublicUrl(c, token)}
        csrfToken={c.get('csrfToken')}
      />
    </PublicLayout>,
  );
});

publicEstimateRoutes.post('/estimate/respond/:token/approve', async (c) => {
  const token = String(c.req.param('token') || '').trim();
  const db = getDb();

  if (!token) {
    return renderPublicMessage(
      c,
      {
        title: 'Estimate Not Found',
        heading: 'Estimate link unavailable',
        message:
          'This estimate link is invalid or incomplete. Please contact the contractor for a new link.',
        tone: 'danger',
      },
      404,
    );
  }

  const estimate = estimates.findByPublicToken(db, token);

  if (!estimate) {
    return renderPublicMessage(
      c,
      {
        title: 'Estimate Not Found',
        heading: 'Estimate link unavailable',
        message:
          'We could not find an estimate for this response link. Please contact the contractor and request a new estimate link.',
        tone: 'danger',
      },
      404,
    );
  }

  const tenantRow = getTenantBranding(db, estimate.tenant_id);
  const appName = process.env.APP_NAME || 'Hudson Business Solutions';
  const appLogo =
    tenantRow?.logo_path ||
    process.env.APP_LOGO ||
    '/static/brand/hudson-business-solutions-logo.png';

  if (estimate.status !== 'sent') {
    return renderPublicMessage(c, {
      title: 'Estimate Already Responded',
      heading: 'This estimate has already been responded to',
      message:
        'A response has already been recorded for this estimate, so no further action is needed here.',
      tone: 'default',
      estimateNumber: estimate.estimate_number,
      companyName: tenantRow?.name || appName,
      appName,
      appLogo,
    });
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const approvalNotes = String(body.approval_notes ?? '').trim().slice(0, 5000);
  const signatureData = String(body.signature_data ?? '').trim().slice(0, 500000);
  const signerName = String(body.signer_name ?? '').trim().slice(0, 200);
  const ip = resolveRequestIp(c);

  if (signatureData) {
    estimates.update(db, estimate.id, estimate.tenant_id, {
      signature_data: signatureData,
      signer_name: signerName || null,
      signature_ip: ip,
      signed_at: new Date().toISOString(),
    });
  }

  convertApprovedEstimateToJob(db, estimate.id, estimate.tenant_id, {
    approvalNotes: approvalNotes || null,
    ipAddress: ip,
  });

  return renderPublicMessage(c, {
    title: 'Estimate Approved',
    heading: 'Estimate approved successfully',
    message:
      'Thank you. Your approval has been recorded successfully. The contractor has been notified and the work can now move into the next internal scheduling steps.',
    tone: 'success',
    estimateNumber: estimate.estimate_number,
    companyName: tenantRow?.name || appName,
    appName,
    appLogo,
  });
});

publicEstimateRoutes.post('/estimate/respond/:token/reject', async (c) => {
  const token = String(c.req.param('token') || '').trim();
  const db = getDb();

  if (!token) {
    return renderPublicMessage(
      c,
      {
        title: 'Estimate Not Found',
        heading: 'Estimate link unavailable',
        message:
          'This estimate link is invalid or incomplete. Please contact the contractor for a new link.',
        tone: 'danger',
      },
      404,
    );
  }

  const estimate = estimates.findByPublicToken(db, token);

  if (!estimate) {
    return renderPublicMessage(
      c,
      {
        title: 'Estimate Not Found',
        heading: 'Estimate link unavailable',
        message:
          'We could not find an estimate for this response link. Please contact the contractor and request a new estimate link.',
        tone: 'danger',
      },
      404,
    );
  }

  const tenantRow = getTenantBranding(db, estimate.tenant_id);
  const appName = process.env.APP_NAME || 'Hudson Business Solutions';
  const appLogo =
    tenantRow?.logo_path ||
    process.env.APP_LOGO ||
    '/static/brand/hudson-business-solutions-logo.png';

  if (estimate.status !== 'sent') {
    return renderPublicMessage(c, {
      title: 'Estimate Already Responded',
      heading: 'This estimate has already been responded to',
      message:
        'A response has already been recorded for this estimate, so no further action is needed here.',
      tone: 'default',
      estimateNumber: estimate.estimate_number,
      companyName: tenantRow?.name || appName,
      appName,
      appLogo,
    });
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const rejectionReason = String(body.rejection_reason ?? '').trim().slice(0, 5000);

  if (!rejectionReason) {
    return renderPublicMessage(c, {
      title: 'Rejection Reason Required',
      heading: 'Please include a reason for rejection',
      message:
        'To reject this estimate, a short reason is required so the contractor can review your feedback and follow up properly.',
      tone: 'danger',
      estimateNumber: estimate.estimate_number,
      companyName: tenantRow?.name || appName,
      appName,
      appLogo,
    });
  }

  estimates.setStatus(db, estimate.id, estimate.tenant_id, 'rejected', {
    responded_at: new Date().toISOString(),
    rejection_reason: rejectionReason,
  });

  return renderPublicMessage(c, {
    title: 'Estimate Rejected',
    heading: 'Estimate rejection recorded',
    message:
      'Your rejection has been recorded successfully. The contractor can now review your feedback and follow up with you if needed.',
    tone: 'default',
    estimateNumber: estimate.estimate_number,
    companyName: tenantRow?.name || appName,
    appName,
    appLogo,
  });
});

export default publicEstimateRoutes;