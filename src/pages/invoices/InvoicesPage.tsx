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

export const InvoicesPage: FC<InvoicesPageProps> = ({ invoices, totalOutstanding, totalOverdue, csrfToken }) => {
  return (
    <div>
      <div class="page-head">
        <div><h1>Invoices</h1><p>Create invoices and track balances.</p></div>
        <div class="actions"><a class="btn btn-primary" href="/add_invoice">Create Invoice</a></div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Invoice</th><th>Job</th><th>Date</th><th>Due</th><th class="right">Amount</th><th class="right">Actions</th></tr>
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
                    <td class="right"><a class="btn" href={`/invoice/${inv.id}`}>View</a></td>
                  </tr>
                ))
              ) : (
                <tr><td colspan={6} class="muted">No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoicesPage;
