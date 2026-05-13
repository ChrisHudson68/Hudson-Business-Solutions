import { sendMail } from './mailer.js';
import { getEnv } from '../config/env.js';

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

export async function sendTenantPaymentNotification(params: {
  tenantEmail: string;
  ccEmails?: string | null;
  companyName: string;
  invoiceNumber: string;
  customerName: string | null;
  amountPaid: number;
  paymentIntentId: string;
  paymentDate: string;
}): Promise<void> {
  if (!getEnv().smtpEnabled) return;

  const company = escapeHtml(params.companyName || 'Your Company');
  const invNum = escapeHtml(params.invoiceNumber);
  const customer = escapeHtml(params.customerName || 'Customer');
  const amount = formatMoney(params.amountPaid);
  const piId = escapeHtml(params.paymentIntentId);
  const date = escapeHtml(params.paymentDate);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F5F7FB;color:#0F172A;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="margin:0;font-size:24px;color:#1E3A5F;">${company}</h1>
      <p style="margin:6px 0 0;color:#64748B;font-size:14px;">Payment Received</p>
    </div>

    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">
      <div style="font-size:13px;color:#166534;font-weight:700;margin-bottom:6px;">PAYMENT RECEIVED</div>
      <div style="font-size:36px;font-weight:900;color:#166534;">$${amount}</div>
      <div style="font-size:14px;color:#166534;margin-top:4px;">Invoice ${invNum}</div>
    </div>

    <div style="background:#fff;border:1px solid #E5EAF2;border-radius:16px;padding:24px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:#F5F7FB;">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;border-radius:8px 0 0 8px;">Invoice #</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:700;border-radius:0 8px 8px 0;">${invNum}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;">Customer</td>
          <td style="padding:10px 14px;font-size:14px;">${customer}</td>
        </tr>
        <tr style="background:#F5F7FB;">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;border-radius:8px 0 0 8px;">Amount Paid</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:700;color:#166534;border-radius:0 8px 8px 0;">$${amount}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;">Date</td>
          <td style="padding:10px 14px;font-size:14px;">${date}</td>
        </tr>
        <tr style="background:#F5F7FB;">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;border-radius:8px 0 0 8px;">Reference</td>
          <td style="padding:10px 14px;font-size:13px;color:#64748B;font-family:monospace;border-radius:0 8px 8px 0;">${piId}</td>
        </tr>
      </table>
    </div>

    <p style="text-align:center;font-size:12px;color:#94A3B8;margin-top:20px;">
      Powered by Hudson Business Solutions
    </p>
  </div>
</body>
</html>`;

  await sendMail({
    to: params.tenantEmail,
    cc: params.ccEmails || undefined,
    subject: `Payment Received — Invoice ${params.invoiceNumber} ($${amount})`,
    text: `Payment of $${amount} received for Invoice ${params.invoiceNumber} from ${params.customerName || 'customer'} on ${params.paymentDate}. Reference: ${params.paymentIntentId}`,
    html,
  });
}

export async function sendCustomerPaymentConfirmation(params: {
  customerEmail: string;
  customerName: string | null;
  companyName: string;
  companyEmail: string | null;
  companyPhone: string | null;
  invoiceNumber: string;
  amountPaid: number;
  paymentDate: string;
}): Promise<void> {
  if (!getEnv().smtpEnabled) return;

  const company = escapeHtml(params.companyName || 'Your Contractor');
  const invNum = escapeHtml(params.invoiceNumber);
  const customer = escapeHtml(params.customerName || 'Customer');
  const amount = formatMoney(params.amountPaid);
  const date = escapeHtml(params.paymentDate);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F5F7FB;color:#0F172A;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="margin:0;font-size:24px;color:#1E3A5F;">${company}</h1>
      <p style="margin:6px 0 0;color:#64748B;font-size:14px;">Payment Confirmation</p>
    </div>

    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:16px;padding:20px;margin-bottom:16px;text-align:center;">
      <div style="font-size:13px;color:#166534;font-weight:700;margin-bottom:6px;">PAYMENT CONFIRMED</div>
      <div style="font-size:36px;font-weight:900;color:#166534;">$${amount}</div>
    </div>

    <div style="background:#fff;border:1px solid #E5EAF2;border-radius:16px;padding:24px;margin-bottom:16px;">
      <p style="margin:0 0 16px;font-size:15px;">Hello ${customer},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Your payment of <strong>$${amount}</strong> for Invoice <strong>${invNum}</strong> from <strong>${company}</strong> has been received. Thank you!
      </p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#F5F7FB;">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;border-radius:8px 0 0 8px;">Invoice #</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:700;border-radius:0 8px 8px 0;">${invNum}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;">Amount Paid</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:700;color:#166534;">$${amount}</td>
        </tr>
        <tr style="background:#F5F7FB;">
          <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#64748B;border-radius:8px 0 0 8px;">Date</td>
          <td style="padding:10px 14px;font-size:14px;border-radius:0 8px 8px 0;">${date}</td>
        </tr>
      </table>
    </div>

    <div style="background:#fff;border:1px solid #E5EAF2;border-radius:16px;padding:20px;font-size:13px;color:#64748B;">
      <p style="margin:0 0 8px;font-weight:700;color:#334155;">Questions?</p>
      ${params.companyEmail ? `<p style="margin:0 0 4px;">Email: ${escapeHtml(params.companyEmail)}</p>` : ''}
      ${params.companyPhone ? `<p style="margin:0 0 4px;">Phone: ${escapeHtml(params.companyPhone)}</p>` : ''}
    </div>

    <p style="text-align:center;font-size:12px;color:#94A3B8;margin-top:20px;">
      Powered by Hudson Business Solutions
    </p>
  </div>
</body>
</html>`;

  await sendMail({
    to: params.customerEmail,
    subject: `Payment Confirmation — Invoice ${params.invoiceNumber} from ${params.companyName}`,
    text: `Your payment of $${amount} for Invoice ${params.invoiceNumber} from ${params.companyName} has been received. Thank you!`,
    html,
  });
}
