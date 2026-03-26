import type { FC } from 'hono/jsx';

type InvoiceLine = {
  id?: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
};

type Invoice = {
  id: number;
  job_id: number;
  job_name: string;
  client_name: string;
  invoice_number: string;
  date_issued: string;
  due_date: string;
  amount: number;
  total_amount?: number | null;
  subtotal_amount?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
  discount_amount?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  notes: string | null;
  public_notes?: string | null;
  internal_notes?: string | null;
  terms_text?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  attachment_filename?: string | null;
  archived_at?: string | null;
  status?: string | null;
  locked_at?: string | null;
  company_name_snapshot?: string | null;
  company_email_snapshot?: string | null;
  company_phone_snapshot?: string | null;
  company_address_snapshot?: string | null;
  company_logo_path_snapshot?: string | null;
  job_code_snapshot?: string | null;
  sent_at?: string | null;
  pdf_generated_at?: string | null;
  pdf_file_path?: string | null;
  pdf_version?: number | null;
  void_reason?: string | null;
  voided_at?: string | null;
};

type Payment = {
  id: number;
  date: string;
  amount: number;
  method: string | null;
  reference: string | null;
};

type TenantInfo = {
  id: number;
  name: string;
  subdomain: string;
  logo_path: string | null;
  invoice_prefix: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
};

interface InvoiceDetailPageProps {
  inv: Invoice;
  lineItems?: InvoiceLine[];
  payments: Payment[];
  paid: number;
  outstanding: number;
  status: string;
  tenant: TenantInfo;
  paymentCount: number;
  csrfToken: string;
  error?: string;
  success?: string;
  paymentForm?: {
    date?: string;
    amount?: string;
    method?: string;
    reference?: string;
  };
  canArchiveInvoices?: boolean;
  canManagePayments?: boolean;
  canEditInvoices?: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status: string) {
  if (status === 'Paid') return <span class="badge badge-good">Paid</span>;
  if (status === 'Overdue') return <span class="badge badge-bad">Overdue</span>;
  if (status === 'Partially Paid') return <span class="badge badge-warn">Partially Paid</span>;
  if (status === 'Draft') return <span class="badge">Draft</span>;
  if (status === 'Voided') return <span class="badge badge-bad">Voided</span>;
  return <span class="badge">{status}</span>;
}

export const InvoiceDetailPage: FC<InvoiceDetailPageProps> = ({
  inv,
  lineItems = [],
  payments,
  paid,
  outstanding,
  status,
  tenant,
  paymentCount,
  csrfToken,
  error,
  success,
  paymentForm,
  canArchiveInvoices,
  canManagePayments,
  canEditInvoices,
}) => {
  const companyName = inv.company_name_snapshot || tenant.name || 'Company';
  const companyAddress = inv.company_address_snapshot || tenant.company_address;
  const companyEmail = inv.company_email_snapshot || tenant.company_email;
  const companyPhone = inv.company_phone_snapshot || tenant.company_phone;
  const logoPath = inv.company_logo_path_snapshot || tenant.logo_path;
  const customerName = inv.customer_name || inv.client_name;
  const subtotal = Number(inv.subtotal_amount ?? inv.amount ?? 0);
  const discountAmount = Number(inv.discount_amount ?? 0);
  const taxAmount = Number(inv.tax_amount ?? 0);
  const total = Number(inv.total_amount ?? inv.amount ?? 0);
  const paymentValues = {
    date: paymentForm?.date ?? '',
    amount: paymentForm?.amount ?? '',
    method: paymentForm?.method ?? '',
    reference: paymentForm?.reference ?? '',
  };

  const canFinalize = !inv.archived_at && canEditInvoices && status === 'Draft';
  const canVoid = !inv.archived_at && canEditInvoices && status !== 'Paid' && status !== 'Voided' && paymentCount === 0;

  return (
    <div style="display:grid; gap:14px;">
      <div class="page-head">
        <div>
          <h1>Invoice {inv.invoice_number}</h1>
          <p class="muted">{inv.job_name}{inv.job_code_snapshot ? ` • ${inv.job_code_snapshot}` : ''}</p>
        </div>
        <div class="actions actions-mobile-stack">
          {!inv.archived_at && canEditInvoices && status === 'Draft' ? <a class="btn" href={`/edit_invoice/${inv.id}`}>Edit Draft</a> : null}
          {canFinalize ? (
            <form method="post" action={`/send_invoice/${inv.id}`} style="display:inline;">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <button class="btn btn-primary" type="submit">Finalize &amp; Lock</button>
            </form>
          ) : null}
          {canVoid ? (
            <form method="post" action={`/void_invoice/${inv.id}`} style="display:inline;">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="void_reason" value="Voided by tenant user." />
              <button class="btn" type="submit">Void Invoice</button>
            </form>
          ) : null}
          <a class="btn" href={`/invoice/${inv.id}/pdf`}>{inv.pdf_file_path ? 'Download Frozen PDF' : 'Download PDF'}</a>
          {canArchiveInvoices ? (
            inv.archived_at ? (
              <form method="post" action={`/restore_invoice/${inv.id}`} style="display:inline;">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button class="btn" type="submit">Restore</button>
              </form>
            ) : (
              <form method="post" action={`/archive_invoice/${inv.id}`} style="display:inline;">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button class="btn" type="submit" disabled={paymentCount > 0}>{paymentCount > 0 ? 'Has Payments' : 'Archive Invoice'}</button>
              </form>
            )
          ) : null}
          <a class="btn" href="/invoices">Back</a>
        </div>
      </div>

      {inv.archived_at ? <div class="card" style="border-color:#FDE68A; background:#FFFBEB; color:#92400E;">This invoice is archived. It remains preserved for history and can be restored.</div> : null}
      {error ? <div class="card" style="border-color:#FECACA; background:#FEF2F2; color:#991B1B;">{error}</div> : null}
      {success ? <div class="card" style="border-color:#BBF7D0; background:#F0FDF4; color:#166534;">{success}</div> : null}
      {status === 'Draft' ? <div class="card" style="border-color:#BFDBFE; background:#EFF6FF; color:#1D4ED8;">This invoice is still a draft. Finalize it when you are ready to lock the totals and generate the frozen PDF snapshot.</div> : null}
      {inv.locked_at && status !== 'Voided' ? <div class="card" style="border-color:#D1D5DB; background:#F9FAFB; color:#374151;">This invoice has been finalized and locked. Line items, totals, and customer snapshots are preserved for history.</div> : null}
      {status === 'Voided' ? <div class="card" style="border-color:#FECACA; background:#FEF2F2; color:#991B1B;">This invoice has been voided{inv.void_reason ? `: ${inv.void_reason}` : '.'}</div> : null}

      <div class="grid grid-2">
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div>
              <div style="font-size:20px; font-weight:900;">{companyName}</div>
              <div class="muted" style="margin-top:8px; line-height:1.6;">
                {companyAddress ? <div>{companyAddress}</div> : null}
                {companyEmail ? <div>{companyEmail}</div> : null}
                {companyPhone ? <div>{companyPhone}</div> : null}
              </div>
            </div>
            {logoPath ? <img src={logoPath} alt="Company logo" style="max-height:90px; border:1px solid #E5EAF2; border-radius:12px; padding:8px; background:white;" /> : null}
          </div>
        </div>

        <div class="card">
          <b>Invoice Summary</b>
          <div class="muted" style="margin-top:10px; line-height:1.8;">
            <div><b>Invoice #:</b> {inv.invoice_number}</div>
            <div><b>Status:</b> {inv.archived_at ? 'Archived' : status}</div>
            <div><b>Date Issued:</b> {inv.date_issued}</div>
            <div><b>Due Date:</b> {inv.due_date}</div>
            <div><b>Customer:</b> {customerName}</div>
            <div><b>Job:</b> {inv.job_name}</div>
            <div><b>PDF:</b> {inv.pdf_file_path ? `Frozen snapshot (v${inv.pdf_version || 1})` : inv.locked_at ? 'Locked invoice without stored snapshot' : 'Generated from current saved draft'}</div>
            <div><b>Sent At:</b> {inv.sent_at || '—'}</div>
            <div><b>Locked:</b> {inv.locked_at || 'No'}</div>
          </div>
          <div style="margin-top:12px;">{statusBadge(status)}</div>
        </div>
      </div>

      <div class="grid grid-3">
        <div class="card"><div class="muted" style="font-weight:900; font-size:12px;">Invoice Total</div><div style="font-size:28px; font-weight:900; margin-top:8px;">${formatCurrency(total)}</div></div>
        <div class="card"><div class="muted" style="font-weight:900; font-size:12px;">Paid</div><div style="font-size:28px; font-weight:900; margin-top:8px;">${formatCurrency(paid)}</div></div>
        <div class="card"><div class="muted" style="font-weight:900; font-size:12px;">Outstanding</div><div style="font-size:28px; font-weight:900; margin-top:8px;">${formatCurrency(outstanding)}</div></div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <b>Bill To</b>
          <div class="muted" style="margin-top:10px; line-height:1.7;">
            <div>{customerName || '—'}</div>
            {inv.customer_address ? <div>{inv.customer_address}</div> : null}
            {inv.customer_email ? <div>{inv.customer_email}</div> : null}
            {inv.customer_phone ? <div>{inv.customer_phone}</div> : null}
          </div>
        </div>
        <div class="card">
          <b>Attachment</b>
          <div style="margin-top:10px;">
            {inv.attachment_filename ? (
              <div class="actions actions-mobile-stack">
                <span class="badge badge-good">Attachment Uploaded</span>
                <a class="btn" href={`/invoice-attachments/${inv.id}`} target="_blank" rel="noreferrer">View Attachment</a>
                {!inv.archived_at && canEditInvoices ? <a class="btn" href={`/edit_invoice/${inv.id}`}>Manage Attachment</a> : null}
              </div>
            ) : <div class="muted">No attachment uploaded.</div>}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="page-head" style="margin-bottom:12px;">
          <div>
            <h3 style="margin:0;">Invoice Line Items</h3>
            <p class="muted" style="margin-top:6px;">The PDF and stored totals are generated from these saved rows.</p>
          </div>
        </div>
        <div class="table-wrap table-wrap-tight">
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th class="right">Unit Price</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit || '—'}</td>
                  <td class="right">${formatCurrency(item.unit_price)}</td>
                  <td class="right">${formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <b>Terms &amp; Notes</b>
          <div style="display:grid; gap:12px; margin-top:10px;">
            <div>
              <div class="muted small" style="font-weight:900;">Customer Notes</div>
              <div class="muted" style="margin-top:6px; white-space:pre-wrap;">{inv.public_notes || inv.notes || '—'}</div>
            </div>
            <div>
              <div class="muted small" style="font-weight:900;">Terms</div>
              <div class="muted" style="margin-top:6px; white-space:pre-wrap;">{inv.terms_text || '—'}</div>
            </div>
            <div>
              <div class="muted small" style="font-weight:900;">Internal Notes</div>
              <div class="muted" style="margin-top:6px; white-space:pre-wrap;">{inv.internal_notes || '—'}</div>
            </div>
          </div>
        </div>
        <div class="card">
          <b>Totals Breakdown</b>
          <div style="display:grid; gap:10px; margin-top:10px;">
            <div style="display:flex; justify-content:space-between; gap:12px;"><span class="muted">Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:12px;"><span class="muted">Discount</span><strong>${formatCurrency(discountAmount)}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:12px;"><span class="muted">Tax</span><strong>${formatCurrency(taxAmount)}</strong></div>
            <div style="display:flex; justify-content:space-between; gap:12px; font-size:20px;"><span><b>Total</b></span><strong>${formatCurrency(total)}</strong></div>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <b>Add Payment</b>
          {inv.archived_at ? (
            <div class="muted" style="margin-top:10px;">Payments cannot be added while this invoice is archived.</div>
          ) : !canManagePayments ? (
            <div class="muted" style="margin-top:10px;">You have view access to this invoice, but not permission to manage payments.</div>
          ) : status === 'Draft' ? (
            <div class="muted" style="margin-top:10px;">Finalize the invoice before recording payments so the totals and PDF are frozen first.</div>
          ) : status === 'Voided' ? (
            <div class="muted" style="margin-top:10px;">Voided invoices cannot receive payments.</div>
          ) : (
            <form method="post" action={`/add_payment/${inv.id}`} style="margin-top:10px;">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <div class="row">
                <div><label>Date</label><input type="date" name="date" value={paymentValues.date} required /></div>
                <div><label>Amount</label><input type="number" step="0.01" min="0.01" name="amount" value={paymentValues.amount} required /></div>
              </div>
              <div class="row">
                <div><label>Method</label><input name="method" value={paymentValues.method} /></div>
                <div><label>Reference</label><input name="reference" value={paymentValues.reference} /></div>
              </div>
              <div class="actions actions-mobile-stack" style="margin-top:14px;"><button class="btn btn-primary" type="submit">Add Payment</button></div>
            </form>
          )}
        </div>
        <div class="card">
          <b>Payment History</b>
          {payments.length ? (
            <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
              <table class="table">
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr></thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr>
                      <td>{payment.date}</td>
                      <td>{payment.method || '—'}</td>
                      <td>{payment.reference || '—'}</td>
                      <td class="right">${formatCurrency(payment.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div class="muted" style="margin-top:10px;">No payments recorded yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailPage;
