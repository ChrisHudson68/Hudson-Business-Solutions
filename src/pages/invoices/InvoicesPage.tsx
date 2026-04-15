import type { FC } from 'hono/jsx';

interface InvoiceRow {
  id: number;
  job_id: number;
  job_name: string;
  client: string;
  invoice_number: string;
  date_issued: string;
  due_date: string;
  amount: number;
  paid: number;
  outstanding: number;
  status: string;
  payment_count: number;
  attachment_filename?: string | null;
  archived_at?: string | null;
}

interface InvoicesPageProps {
  invoices: InvoiceRow[];
  totalOutstanding: number;
  totalOverdue: number;
  csrfToken: string;
  showArchived?: boolean;
  canArchiveInvoices?: boolean;
  canCreateInvoices?: boolean;
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderStatus(status: string, archivedAt?: string | null) {
  if (archivedAt) return <span class="badge badge-warn">Archived</span>;
  if (status === 'Paid') return <span class="badge badge-good">Paid</span>;
  if (status === 'Overdue') return <span class="badge badge-bad">Overdue</span>;
  if (status === 'Partially Paid') return <span class="badge badge-warn">Partial</span>;
  if (status === 'Draft') return <span class="badge">Draft</span>;
  if (status === 'Sent') return <span class="badge badge-blue">Sent</span>;
  if (status === 'Voided') return <span class="badge badge-bad">Voided</span>;
  return <span class="badge">{status || 'Unpaid'}</span>;
}

export const InvoicesPage: FC<InvoicesPageProps> = ({
  invoices,
  totalOutstanding,
  totalOverdue,
  csrfToken,
  showArchived,
  canArchiveInvoices,
  canCreateInvoices,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Invoices</h1>
          <p>Manage billing, customer balances, payments, and PDF invoice records.</p>
        </div>
        <div class="actions">
          <a class="btn" href={showArchived ? '/invoices' : '/invoices?show_archived=1'}>
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </a>
          {canCreateInvoices ? <a class="btn btn-primary" href="/add_invoice">+ Create Invoice</a> : null}
        </div>
      </div>

      <div class="stat-grid stat-grid-2" style="margin-bottom:16px;">
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Outstanding Balance</div>
          <div class="stat-value">${fmt(totalOutstanding || 0)}</div>
          <div class="stat-sub">Unpaid and partially paid invoices</div>
        </div>
        <div class="stat-card stat-card-red">
          <div class="stat-label">Overdue</div>
          <div class="stat-value">${fmt(totalOverdue || 0)}</div>
          <div class="stat-sub">Past due date and unpaid</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h2>All Invoices</h2>
            {showArchived ? <p>Showing archived invoices</p> : null}
          </div>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
            {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
          </span>
        </div>

        {invoices.length > 0 ? (
          <div class="table-wrap" style="margin:0 -18px -16px;">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Job</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th class="right">Total</th>
                  <th>Status</th>
                  <th>Attachment</th>
                  <th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr>
                    <td>
                      <a href={`/invoice/${inv.id}`} style="font-weight:800; color:var(--navy);">
                        {inv.invoice_number}
                      </a>
                      <div class="muted" style="font-size:12px; margin-top:2px;">
                        {inv.client || 'No client'}
                      </div>
                    </td>
                    <td>{inv.job_name || '—'}</td>
                    <td style="white-space:nowrap;">{inv.date_issued || '—'}</td>
                    <td style="white-space:nowrap;">{inv.due_date || '—'}</td>
                    <td class="right" style="font-weight:700;">${fmt(inv.amount || 0)}</td>
                    <td>{renderStatus(inv.status, inv.archived_at)}</td>
                    <td>
                      {inv.attachment_filename ? (
                        <a class="btn btn-sm" href={`/invoice-attachments/${inv.id}`} target="_blank" rel="noreferrer">
                          View PDF
                        </a>
                      ) : (
                        <span class="muted" style="font-size:12px;">None</span>
                      )}
                    </td>
                    <td class="right">
                      <div class="actions" style="justify-content:flex-end; gap:6px;">
                        <a class="btn btn-sm" href={`/invoice/${inv.id}`}>View</a>
                        {canArchiveInvoices ? (
                          inv.archived_at ? (
                            <form method="post" action={`/restore_invoice/${inv.id}`} style="display:inline;">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn btn-sm" type="submit">Restore</button>
                            </form>
                          ) : (
                            <form method="post" action={`/archive_invoice/${inv.id}`} style="display:inline;">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button
                                class="btn btn-sm"
                                type="submit"
                                disabled={inv.payment_count > 0}
                                title={inv.payment_count > 0 ? 'Cannot archive invoices with payments' : ''}
                              >
                                {inv.payment_count > 0 ? 'Has Payments' : 'Archive'}
                              </button>
                            </form>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="empty-state">
            <div class="empty-state-icon">🧾</div>
            <h3>{showArchived ? 'No archived invoices' : 'No invoices yet'}</h3>
            <p>
              {showArchived
                ? 'Archived invoices will appear here.'
                : 'Create invoices to bill customers, track balances, and generate PDF records.'}
            </p>
            {!showArchived && canCreateInvoices ? (
              <a class="btn btn-primary" href="/add_invoice">+ Create Your First Invoice</a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;
