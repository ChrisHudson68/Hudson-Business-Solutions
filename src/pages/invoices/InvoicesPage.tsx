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

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          <p>Create invoices and track balances.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={showArchived ? '/invoices' : '/invoices?show_archived=1'}>
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </a>
          {canCreateInvoices ? <a class="btn btn-primary" href="/add_invoice">Create Invoice</a> : null}
        </div>
      </div>

      <div class="grid grid-2 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Outstanding</div>
          <div class="metric-value">${formatCurrency(totalOutstanding || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Overdue</div>
          <div class="metric-value">${formatCurrency(totalOverdue || 0)}</div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap table-wrap-tight">
          <table class="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Job</th>
                <th>Date</th>
                <th>Due</th>
                <th>Attachment</th>
                <th class="right">Amount</th>
                <th>Status</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr>
                    <td>
                      <div><b>{inv.invoice_number}</b></div>
                      <div class="muted small">{inv.archived_at ? 'Archived' : 'Active'}</div>
                    </td>
                    <td>{inv.job_name}</td>
                    <td>{inv.date_issued}</td>
                    <td>{inv.due_date}</td>
                    <td>
                      {inv.attachment_filename ? (
                        <div class="actions actions-mobile-stack">
                          <span class="badge badge-good">Attached</span>
                          <a
                            class="btn"
                            href={`/invoice-attachments/${inv.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        </div>
                      ) : (
                        <span class="muted">No attachment</span>
                      )}
                    </td>
                    <td class="right">${formatCurrency(inv.amount || 0)}</td>
                    <td>
                      {inv.archived_at ? (
                        <span class="badge badge-warn">Archived</span>
                      ) : inv.status === 'Overdue' ? (
                        <span class="badge badge-bad">Overdue</span>
                      ) : inv.status === 'Paid' ? (
                        <span class="badge badge-good">Paid</span>
                      ) : (
                        <span class="badge">Unpaid</span>
                      )}
                    </td>
                    <td class="right">
                      <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                        <a class="btn" href={`/invoice/${inv.id}`}>View</a>

                        {canArchiveInvoices ? (
                          inv.archived_at ? (
                            <form method="post" action={`/restore_invoice/${inv.id}`} class="inline-form">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit">Restore</button>
                            </form>
                          ) : (
                            <form method="post" action={`/archive_invoice/${inv.id}`} class="inline-form">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit" disabled={inv.payment_count > 0}>
                                {inv.payment_count > 0 ? 'Has Payments' : 'Archive'}
                              </button>
                            </form>
                          )
                        ) : (
                          <span class="muted">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={8} class="muted">
                    {showArchived ? 'No archived invoices found.' : 'No active invoices yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div class="muted" style="margin-top:12px;">
          Archived invoices are hidden from normal lists but preserved for financial history and recovery. Invoices with payments attached cannot be archived in this phase.
        </div>
      </div>
    </div>
  );
};

export default InvoicesPage;