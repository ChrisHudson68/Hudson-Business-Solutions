import crypto from 'node:crypto';
import type { DB } from '../db/connection.js';
import * as estimates from '../db/queries/estimates.js';
import { sendMail } from './mailer.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function sendEstimateToCustomer(
  db: DB,
  estimateId: number,
  tenantId: number,
  updatedByUserId: number,
  publicBaseUrl: string,
): Promise<{ token: string; publicUrl: string; recipientEmail: string; messageId: string }> {
  const estimate = estimates.findWithLineItemsById(db, estimateId, tenantId);

  if (!estimate) {
    throw new Error('Estimate not found.');
  }

  if (!['draft', 'ready', 'sent'].includes(String(estimate.status || '').toLowerCase())) {
    throw new Error('Only draft, ready, or sent estimates can be delivered to a customer.');
  }

  const recipientEmail = String(estimate.customer_email || '').trim();
  if (!recipientEmail) {
    throw new Error('Customer email is required before sending this estimate.');
  }

  const tenantRow = db.prepare(`
    SELECT
      name,
      company_email,
      company_phone,
      company_address,
      notification_cc_emails
    FROM tenants
    WHERE id = ?
    LIMIT 1
  `).get(tenantId) as
    | {
        name: string;
        company_email: string | null;
        company_phone: string | null;
        company_address: string | null;
        notification_cc_emails: string | null;
      }
    | undefined;

  const companyName = tenantRow?.name || 'Hudson Business Solutions';
  const companyEmail = String(tenantRow?.company_email || '').trim();
  const companyPhone = String(tenantRow?.company_phone || '').trim();
  const companyAddress = String(tenantRow?.company_address || '').trim();
  const ccEmails = String(tenantRow?.notification_cc_emails || '').trim() || undefined;

  const token =
    String(estimate.public_token || '').trim() ||
    crypto.randomBytes(24).toString('hex');

  const normalizedBaseUrl = String(publicBaseUrl || '').replace(/\/$/, '');
  if (!normalizedBaseUrl) {
    throw new Error('Unable to generate public estimate URL.');
  }

  const publicUrl = `${normalizedBaseUrl}/estimate/view/${token}`;

  const lineItemsHtml = estimate.line_items.length
    ? estimate.line_items
        .map(
          (item) => `
            <tr>
              <td style="padding:10px 12px; border-bottom:1px solid #E5EAF2;">${escapeHtml(item.description)}</td>
              <td style="padding:10px 12px; border-bottom:1px solid #E5EAF2; text-align:right;">${Number(item.quantity || 0).toFixed(2)}</td>
              <td style="padding:10px 12px; border-bottom:1px solid #E5EAF2; text-align:right;">$${formatMoney(item.unit_price)}</td>
              <td style="padding:10px 12px; border-bottom:1px solid #E5EAF2; text-align:right; font-weight:700;">$${formatMoney(item.line_total)}</td>
            </tr>
          `,
        )
        .join('')
    : `
        <tr>
          <td colspan="4" style="padding:12px; color:#64748B;">No line items listed.</td>
        </tr>
      `;

  const subject = `${companyName} estimate ${estimate.estimate_number} ready for review`;

  const text = [
    `${companyName}`,
    '',
    `Estimate ${estimate.estimate_number} is ready for your review.`,
    '',
    `Customer: ${estimate.customer_name}`,
    `Total: $${formatMoney(estimate.total)}`,
    estimate.site_address ? `Site Address: ${estimate.site_address}` : '',
    '',
    estimate.scope_of_work ? `Scope of Work:\n${estimate.scope_of_work}` : '',
    '',
    `Review and respond here: ${publicUrl}`,
    '',
    companyEmail ? `Reply Email: ${companyEmail}` : '',
    companyPhone ? `Phone: ${companyPhone}` : '',
    companyAddress ? `Address: ${companyAddress}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="margin:0; padding:24px; background:#F8FAFC; font-family:Arial, Helvetica, sans-serif; color:#0F172A;">
      <div style="max-width:760px; margin:0 auto; background:#FFFFFF; border:1px solid #E5EAF2; border-radius:18px; overflow:hidden;">
        <div style="padding:24px 24px 18px; background:#0F172A; color:#FFFFFF;">
          <div style="font-size:14px; letter-spacing:.08em; text-transform:uppercase; opacity:.8;">Estimate Ready for Review</div>
          <div style="font-size:28px; font-weight:800; margin-top:8px;">${escapeHtml(companyName)}</div>
          <div style="margin-top:10px; font-size:16px;">Estimate ${escapeHtml(estimate.estimate_number)}</div>
        </div>

        <div style="padding:24px;">
          <p style="margin-top:0; line-height:1.6;">
            Hello ${escapeHtml(estimate.customer_name)},
          </p>

          <p style="line-height:1.6;">
            Your estimate is ready for review. Please use the secure link below to approve or reject it online.
          </p>

          <div style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); margin:20px 0;">
            <div style="border:1px solid #E5EAF2; border-radius:14px; padding:14px;">
              <div style="font-size:12px; color:#64748B; text-transform:uppercase; letter-spacing:.06em;">Estimate Number</div>
              <div style="font-size:18px; font-weight:800; margin-top:6px;">${escapeHtml(estimate.estimate_number)}</div>
            </div>
            <div style="border:1px solid #E5EAF2; border-radius:14px; padding:14px;">
              <div style="font-size:12px; color:#64748B; text-transform:uppercase; letter-spacing:.06em;">Total</div>
              <div style="font-size:24px; font-weight:800; margin-top:6px;">$${formatMoney(estimate.total)}</div>
            </div>
          </div>

          ${
            estimate.scope_of_work
              ? `
                <div style="margin:18px 0;">
                  <div style="font-weight:800; margin-bottom:8px;">Scope of Work</div>
                  <div style="white-space:pre-wrap; line-height:1.6;">${escapeHtml(estimate.scope_of_work)}</div>
                </div>
              `
              : ''
          }

          <div style="margin:18px 0;">
            <div style="font-weight:800; margin-bottom:10px;">Line Items</div>
            <table style="width:100%; border-collapse:collapse; border:1px solid #E5EAF2; border-radius:14px; overflow:hidden;">
              <thead>
                <tr style="background:#F8FAFC;">
                  <th style="padding:10px 12px; text-align:left;">Description</th>
                  <th style="padding:10px 12px; text-align:right;">Qty</th>
                  <th style="padding:10px 12px; text-align:right;">Unit</th>
                  <th style="padding:10px 12px; text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHtml}
              </tbody>
            </table>
          </div>

          <div style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); margin:18px 0 24px;">
            <div style="border:1px solid #E5EAF2; border-radius:14px; padding:14px;">
              <div style="font-size:12px; color:#64748B;">Subtotal</div>
              <div style="margin-top:6px; font-weight:800;">$${formatMoney(estimate.subtotal)}</div>
            </div>
            <div style="border:1px solid #E5EAF2; border-radius:14px; padding:14px;">
              <div style="font-size:12px; color:#64748B;">Tax</div>
              <div style="margin-top:6px; font-weight:800;">$${formatMoney(estimate.tax)}</div>
            </div>
            <div style="border:1px solid #E5EAF2; border-radius:14px; padding:14px;">
              <div style="font-size:12px; color:#64748B;">Grand Total</div>
              <div style="margin-top:6px; font-size:20px; font-weight:900;">$${formatMoney(estimate.total)}</div>
            </div>
          </div>

          <div style="margin:26px 0;">
            <a
              href="${escapeHtml(publicUrl)}"
              style="display:inline-block; background:#1D4ED8; color:#FFFFFF; text-decoration:none; padding:14px 20px; border-radius:12px; font-weight:800;"
            >
              Review Estimate
            </a>
          </div>

          <p style="line-height:1.6; margin-bottom:0;">
            If the button does not work, copy and paste this link into your browser:<br />
            <span style="word-break:break-all; color:#1D4ED8;">${escapeHtml(publicUrl)}</span>
          </p>
        </div>

        <div style="padding:18px 24px; border-top:1px solid #E5EAF2; background:#F8FAFC; color:#475569; font-size:14px;">
          <div style="font-weight:800; color:#0F172A;">${escapeHtml(companyName)}</div>
          ${companyEmail ? `<div style="margin-top:4px;">${escapeHtml(companyEmail)}</div>` : ''}
          ${companyPhone ? `<div style="margin-top:4px;">${escapeHtml(companyPhone)}</div>` : ''}
          ${companyAddress ? `<div style="margin-top:4px;">${escapeHtml(companyAddress)}</div>` : ''}
        </div>
      </div>
    </div>
  `;

  const previousStatus = estimate.status;
  const previousSentAt = estimate.sent_at;
  const previousToken = estimate.public_token;

  estimates.setStatus(db, estimateId, tenantId, 'sent', {
    updated_by_user_id: updatedByUserId,
    sent_at: previousSentAt || new Date().toISOString(),
    public_token: token,
  });

  try {
    const result = await sendMail({
      to: recipientEmail,
      cc: ccEmails,
      subject,
      text,
      html,
      replyTo: companyEmail || undefined,
    });

    return {
      token,
      publicUrl,
      recipientEmail,
      messageId: result.messageId,
    };
  } catch (error) {
    estimates.update(db, estimateId, tenantId, {
      status: previousStatus,
      updated_by_user_id: updatedByUserId,
      sent_at: previousSentAt ?? null,
      public_token: previousToken ?? null,
    });

    throw error;
  }
}