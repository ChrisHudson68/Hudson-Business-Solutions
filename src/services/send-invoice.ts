import crypto from 'node:crypto';
import type { DB } from '../db/connection.js';
import * as invoices from '../db/queries/invoices.js';
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

export async function sendInvoiceForSignature(
  db: DB,
  invoiceId: number,
  tenantId: number,
  publicBaseUrl: string,
): Promise<{ token: string; publicUrl: string; recipientEmail: string; messageId: string }> {
  const inv = db.prepare(`
    SELECT i.id, i.invoice_number, i.date_issued, i.due_date, i.amount,
           i.notes, i.status, i.archived_at,
           i.customer_name, i.customer_email, i.customer_phone, i.customer_address,
           j.job_name, j.client_name
    FROM invoices i
    JOIN jobs j ON j.id = i.job_id AND j.tenant_id = i.tenant_id
    WHERE i.id = ? AND i.tenant_id = ?
  `).get(invoiceId, tenantId) as {
    id: number;
    invoice_number: string;
    date_issued: string;
    due_date: string;
    amount: number;
    notes: string | null;
    status: string;
    archived_at: string | null;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    customer_address: string | null;
    job_name: string;
    client_name: string | null;
  } | undefined;

  if (!inv) throw new Error('Invoice not found.');
  if (inv.archived_at) throw new Error('Cannot send an archived invoice.');

  const recipientEmail = String(inv.customer_email || inv.client_name || '').trim();
  if (!recipientEmail || !recipientEmail.includes('@')) {
    throw new Error('A valid customer email is required to send this invoice for signature.');
  }

  const tenantRow = db.prepare(`
    SELECT name, company_email, company_phone, company_address
    FROM tenants WHERE id = ? LIMIT 1
  `).get(tenantId) as {
    name: string;
    company_email: string | null;
    company_phone: string | null;
    company_address: string | null;
  } | undefined;

  if (!tenantRow) throw new Error('Tenant not found.');

  const token = crypto.randomBytes(24).toString('hex');
  const publicUrl = `${publicBaseUrl}/invoice/view/${token}`;

  invoices.setSignatureToken(db, invoiceId, tenantId, token);

  const companyName = escapeHtml(tenantRow.name || 'Your Contractor');
  const invNumber = escapeHtml(inv.invoice_number || String(inv.id));
  const jobName = escapeHtml(inv.job_name || '');
  const clientName = escapeHtml(inv.customer_name || inv.client_name || 'Customer');
  const amount = formatMoney(inv.amount ?? 0);
  const dueDate = escapeHtml(inv.due_date || '');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F5F7FB;color:#0F172A;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="margin:0;font-size:24px;color:#1E3A5F;">${companyName}</h1>
      <p style="margin:6px 0 0;color:#64748B;font-size:14px;">Invoice for Signature</p>
    </div>

    <div style="background:#fff;border:1px solid #E5EAF2;border-radius:16px;padding:24px;margin-bottom:16px;">
      <p style="margin:0 0 16px;font-size:15px;">Hello ${clientName},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Please review and sign Invoice <strong>${invNumber}</strong> from <strong>${companyName}</strong>.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#F5F7FB;">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;border-radius:8px 0 0 8px;">Invoice #</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:700;border-radius:0 8px 8px 0;">${invNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;">Job</td>
          <td style="padding:10px 14px;font-size:14px;">${jobName}</td>
        </tr>
        <tr style="background:#F5F7FB;">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;border-radius:8px 0 0 8px;">Due Date</td>
          <td style="padding:10px 14px;font-size:14px;border-radius:0 8px 8px 0;">${dueDate}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;">Amount Due</td>
          <td style="padding:10px 14px;font-size:20px;font-weight:900;color:#1E3A5F;">$${amount}</td>
        </tr>
      </table>

      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${publicUrl}"
           style="display:inline-block;background:#1E3A5F;color:#fff;font-weight:700;font-size:15px;
                  padding:14px 32px;border-radius:12px;text-decoration:none;">
          Review &amp; Sign Invoice
        </a>
      </div>
    </div>

    <div style="background:#fff;border:1px solid #E5EAF2;border-radius:16px;padding:20px;font-size:13px;color:#64748B;">
      <p style="margin:0 0 8px;font-weight:700;color:#334155;">Questions?</p>
      ${tenantRow.company_email ? `<p style="margin:0 0 4px;">Email: ${escapeHtml(tenantRow.company_email)}</p>` : ''}
      ${tenantRow.company_phone ? `<p style="margin:0 0 4px;">Phone: ${escapeHtml(tenantRow.company_phone)}</p>` : ''}
    </div>

    <p style="text-align:center;font-size:12px;color:#94A3B8;margin-top:20px;">
      Powered by Hudson Business Solutions
    </p>
  </div>
</body>
</html>`;

  const result = await sendMail({
    to: recipientEmail,
    subject: `Invoice ${invNumber} from ${tenantRow.name} — Please Review & Sign`,
    text: `Invoice ${inv.invoice_number} from ${tenantRow.name} — Review and sign at: ${publicUrl}`,
    html,
  });

  return { token, publicUrl, recipientEmail, messageId: result.messageId };
}
