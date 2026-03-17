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
}

interface InvoicesPageProps {
  invoices: InvoiceRow[];
  totalOutstanding: number;
  totalOverdue: number;
  csrfToken: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const InvoicesPage: FC<InvoicesPageProps> = ({
  invoices,
  totalOutstanding,
  totalOverdue,
  csrfToken,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Invoices</h1>
          <p>Create invoices and track balances.</p>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="/add_invoice">Create Invoice</a>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:14px;">
        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Outstanding</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatCurrency(totalOutstanding || 0)}
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Overdue</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatCurrency(totalOverdue || 0)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Job</th>
                <th>Date</th>
                <th>Due</th>
                <th class="right">Amount</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr>
                    <td><b>{inv.invoice_number}</b></td>
                    <td>{inv.job_name}</td>
                    <td>{inv.date_issued}</td>
                    <td>{inv.due_date}</td>
                    <td class="right">${formatCurrency(inv.amount || 0)}</td>
                    <td class="right">
                      <div class="actions" style="justify-content:flex-end;">
                        <a class="btn" href={`/invoice/${inv.id}`}>View</a>
                        <form method="post" action={`/delete_invoice/${inv.id}`} style="display:inline;">
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit" disabled={inv.payment_count > 0}>
                            {inv.payment_count > 0 ? 'Has Payments' : 'Delete'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={6} class="muted">No invoices yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div class="muted" style="margin-top:12px;">
          Invoices can only be deleted when no payments are attached.
        </div>
      </div>
    </div>
  );
};

export default InvoicesPage;