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
  const hasInvoices = invoices.length > 0;

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
        {hasInvoices ? (
          <>
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
                  {invoices.map((inv) => (
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
                  ))}
                </tbody>
              </table>
            </div>

            <div class="muted" style="margin-top:12px;">
              Archived invoices are hidden from normal lists but preserved for financial history and recovery. Invoices with payments attached cannot be archived in this phase.
            </div>
          </>
        ) : (
          <div style="text-align:center; padding:36px 20px;">
            <div style="
              width:64px;
              height:64px;
              margin:0 auto 16px;
              border-radius:16px;
              background:#EFF6FF;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:28px;
              font-weight:900;
              color:#1D4ED8;
            ">
              🧾
            </div>

            <h2 style="margin:0 0 10px;">
              {showArchived ? 'No archived invoices yet' : 'No invoices yet'}
            </h2>

            <p class="muted" style="max-width:520px; margin:0 auto 16px;">
              Invoices help you bill customers, track receivables, monitor overdue balances,
              and measure how much contract value has been billed and collected.
            </p>

            {!showArchived && canCreateInvoices ? (
              <a class="btn btn-primary" href="/add_invoice">
                Create Your First Invoice
              </a>
            ) : null}

            <div class="muted small" style="margin-top:14px;">
              {showArchived
                ? 'Archived invoices will appear here once records are archived.'
                : 'Most teams create invoices after setting up jobs so billing can be tracked accurately.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;