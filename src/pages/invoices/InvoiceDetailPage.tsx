import type { FC } from 'hono/jsx';

interface Invoice {
  id: number;
  job_id: number;
  job_name: string;
  client_name: string;
  invoice_number: string;
  date_issued: string;
  due_date: string;
  amount: number;
  notes: string | null;
  attachment_filename?: string | null;
  archived_at?: string | null;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  method: string | null;
  reference: string | null;
  attachment_filename?: string | null;
  attachment_original_name?: string | null;
}

interface TenantInfo {
  id: number;
  name: string;
  subdomain: string;
  logo_path: string | null;
  invoice_prefix: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
}

interface InvoiceDetailPageProps {
  inv: Invoice;
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
    attachmentName?: string;
  };
  canArchiveInvoices?: boolean;
  canManagePayments?: boolean;
  canEditInvoices?: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const InvoiceDetailPage: FC<InvoiceDetailPageProps> = ({
  inv,
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
  const paymentValues = {
    date: paymentForm?.date ?? '',
    amount: paymentForm?.amount ?? '',
    method: paymentForm?.method ?? '',
    reference: paymentForm?.reference ?? '',
    attachmentName: paymentForm?.attachmentName ?? '',
  };

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Invoice {inv.invoice_number}</h1>
          <p class="muted">{inv.job_name}</p>
        </div>
        <div class="actions actions-mobile-stack">
          {!inv.archived_at && canEditInvoices ? <a class="btn" href={`/edit_invoice/${inv.id}`}>Edit Invoice</a> : null}
          <a class="btn" href={`/invoice/${inv.id}/pdf`}>Download PDF</a>

          {canArchiveInvoices ? (
            inv.archived_at ? (
              <form method="post" action={`/restore_invoice/${inv.id}`} style="display:inline;">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button class="btn" type="submit">Restore</button>
              </form>
            ) : (
              <form method="post" action={`/archive_invoice/${inv.id}`} style="display:inline;">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button class="btn" type="submit" disabled={paymentCount > 0}>
                  {paymentCount > 0 ? 'Has Payments' : 'Archive Invoice'}
                </button>
              </form>
            )
          ) : null}

          <a class="btn" href="/invoices">Back</a>
        </div>
      </div>

      {inv.archived_at ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;"
        >
          This invoice is archived. It remains preserved for history and can be restored.
        </div>
      ) : null}

      {error ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;"
        >
          {success}
        </div>
      ) : null}

      <div class="grid grid-2">
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div>
              <div style="font-size:20px; font-weight:900;">{tenant.name || 'Company'}</div>
              <div class="muted" style="margin-top:8px; line-height:1.6;">
                {tenant.company_address ? <div>{tenant.company_address}</div> : null}
                {tenant.company_email ? <div>{tenant.company_email}</div> : null}
                {tenant.company_phone ? <div>{tenant.company_phone}</div> : null}
              </div>
            </div>

            {tenant.logo_path ? (
              <div>
                <img
                  src={tenant.logo_path}
                  alt="Company Logo"
                  style="max-height:90px; border:1px solid #E5EAF2; border-radius:12px; padding:8px; background:white;"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div class="card">
          <div class="card-head" style="margin-bottom:12px;">
            <h3>Invoice Summary</h3>
          </div>
          <div class="muted" style="line-height:1.8;">
            <div><b>Invoice #:</b> {inv.invoice_number}</div>
            <div><b>Date Issued:</b> {inv.date_issued}</div>
            <div><b>Due Date:</b> {inv.due_date}</div>
            <div><b>Client:</b> {inv.client_name}</div>
            <div><b>Job:</b> {inv.job_name}</div>
          </div>
        </div>
      </div>

      <div class="stat-grid stat-grid-4" style="margin-top:14px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Invoice Amount</div>
          <div class="stat-value">${formatCurrency(inv.amount || 0)}</div>
        </div>
        <div class="stat-card stat-card-green">
          <div class="stat-label">Paid</div>
          <div class="stat-value">${formatCurrency(paid || 0)}</div>
        </div>
        <div class="stat-card stat-card-red">
          <div class="stat-label">Outstanding</div>
          <div class="stat-value">${formatCurrency(outstanding || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Status</div>
          <div style="margin-top:10px;">
            <span class={`badge${status === 'Overdue' ? ' badge-bad' : status === 'Paid' ? ' badge-good' : ''}`}>
              {inv.archived_at ? 'Archived' : status}
            </span>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <b>Notes</b>
          <p class="muted" style="margin-top:10px;">{inv.notes || '—'}</p>
        </div>

        <div class="card">
          <b>Attachment</b>
          <div style="margin-top:10px;">
            {inv.attachment_filename ? (
              <div class="actions actions-mobile-stack">
                <span class="badge badge-good">Attachment Uploaded</span>
                <a
                  class="btn"
                  href={`/invoice-attachments/${inv.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Attachment
                </a>
                {!inv.archived_at && canEditInvoices ? (
                  <a class="btn" href={`/edit_invoice/${inv.id}`}>Manage Attachment</a>
                ) : null}
              </div>
            ) : (
              <div class="actions actions-mobile-stack">
                <span class="muted">No attachment uploaded.</span>
                {!inv.archived_at && canEditInvoices ? (
                  <a class="btn" href={`/edit_invoice/${inv.id}`}>Add Attachment</a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <b>Add Payment</b>
          {inv.archived_at ? (
            <div class="muted" style="margin-top:10px;">
              Payments cannot be added while this invoice is archived.
            </div>
          ) : !canManagePayments ? (
            <div class="muted" style="margin-top:10px;">
              You have view access to this invoice, but not permission to manage payments.
            </div>
          ) : (
            <form method="post" action={`/add_payment/${inv.id}`} encType="multipart/form-data" style="margin-top:10px;">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <div class="row">
                <div>
                  <label>Date</label>
                  <input type="date" name="date" value={paymentValues.date} required />
                </div>
                <div>
                  <label>Amount</label>
                  <input type="number" step="0.01" min="0.01" name="amount" value={paymentValues.amount} required />
                </div>
              </div>

              <div class="row">
                <div>
                  <label>Method</label>
                  <input type="text" name="method" maxLength={50} value={paymentValues.method} />
                </div>
                <div>
                  <label>Reference</label>
                  <input type="text" name="reference" maxLength={100} value={paymentValues.reference} />
                </div>
              </div>

              <div style="margin-top:14px;">
                <label>Payment Backup (optional)</label>
                <input
                  type="file"
                  name="attachment"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
                />
                <div class="muted" style="margin-top:6px;">
                  Upload a check image or PDF backup for this payment.
                </div>
                {paymentValues.attachmentName ? (
                  <div class="muted" style="margin-top:6px;">Selected file: {paymentValues.attachmentName}</div>
                ) : null}
              </div>

              <div class="actions actions-mobile-stack" style="margin-top:16px;">
                <button class="btn btn-primary" type="submit">Add Payment</button>
              </div>
            </form>
          )}
        </div>

        <div class="card">
          <b>Payments</b>

          {payments.length > 0 ? (
            <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Backup</th>
                    <th class="right">Amount</th>
                    <th class="right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr>
                      <td>{payment.date}</td>
                      <td>{payment.method || '—'}</td>
                      <td>{payment.reference || '—'}</td>
                      <td>
                        {payment.attachment_filename ? (
                          <a
                            class="btn btn-small"
                            href={`/payment-attachments/${payment.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View Backup
                          </a>
                        ) : (
                          <span class="muted">—</span>
                        )}
                      </td>
                      <td class="right">${formatCurrency(payment.amount || 0)}</td>
                      <td class="right">
                        {inv.archived_at ? (
                          <span class="muted">Locked</span>
                        ) : canManagePayments ? (
                          <form
                            method="post"
                            action={`/delete_payment/${payment.id}/${inv.id}`}
                            class="inline-form"
                            onsubmit="return confirm('Delete this payment?');"
                          >
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button class="btn" type="submit">Delete</button>
                          </form>
                        ) : (
                          <span class="muted">View only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div class="muted" style="margin-top:10px;">No payments recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailPage;
