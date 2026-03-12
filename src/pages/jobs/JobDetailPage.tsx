import type { FC } from 'hono/jsx';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

interface JobDetailPageProps {
  job: {
    id: number;
    job_name: string | null;
    job_code: string | null;
    client_name: string | null;
    contract_amount: number | null;
    retainage_percent: number | null;
    start_date: string | null;
    status: string | null;
  };
  incomeRows: {
    id: number;
    date: string | null;
    amount: number | null;
    description: string | null;
  }[];
  expenseRows: {
    id: number;
    date: string | null;
    category: string | null;
    vendor: string | null;
    amount: number | null;
    receipt_filename: string | null;
  }[];
  totalIncome: number;
  baseExpenses: number;
  laborHours: number;
  laborCost: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
  remainingContract: number;
  retainageHeld: number;
  invoiceTotal: number;
  paymentsTotal: number;
  unpaidInvoiceBalance: number;
  csrfToken: string;
}

export const JobDetailPage: FC<JobDetailPageProps> = ({
  job,
  incomeRows,
  expenseRows,
  totalIncome,
  baseExpenses,
  laborHours,
  laborCost,
  totalExpenses,
  profit,
  profitMargin,
  remainingContract,
  retainageHeld,
  invoiceTotal,
  paymentsTotal,
  unpaidInvoiceBalance,
  csrfToken,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{job ? job.job_name : 'Job'}</h1>
          <p class="muted">
            {job?.client_name || ''}
            {job?.job_code ? ` • ${job.job_code}` : ''}
          </p>
        </div>
        <div class="actions">
          {job ? <a class="btn" href={`/edit_job/${job.id}`}>Edit</a> : null}
          <a class="btn" href="/jobs">Back</a>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <b>Job Summary</b>
          <div class="muted" style="margin-top:10px;">
            <div><b>Job Code:</b> {job.job_code || '\u2014'}</div>
            <div><b>Client:</b> {job.client_name || '\u2014'}</div>
            <div><b>Contract:</b> ${fmt(job.contract_amount || 0)}</div>
            <div><b>Retainage:</b> {fmt(job.retainage_percent || 0)}%</div>
            <div><b>Status:</b> <span class="badge">{job ? job.status : '\u2014'}</span></div>
            <div><b>Start Date:</b> {job.start_date || '\u2014'}</div>
          </div>
        </div>

        <div class="card">
          <b>Actions</b>
          <div class="actions" style="margin-top:12px; flex-wrap:wrap;">
            {job ? (
              <>
                <a class="btn btn-primary" href={`/add_income/${job.id}`}>Add Income</a>
                <a class="btn" href={`/add_expense/${job.id}`}>Add Expense</a>
              </>
            ) : null}
          </div>
          <p class="muted" style="margin-top:10px;">Use these to keep job costing and cash flow accurate.</p>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:14px;">
        <div class="card">
          <b>Income Received</b>
          <div style="font-size:24px; font-weight:900; margin-top:10px;">
            ${fmt(totalIncome || 0)}
          </div>
        </div>

        <div class="card">
          <b>Total Costs</b>
          <div style="font-size:24px; font-weight:900; margin-top:10px;">
            ${fmt(totalExpenses || 0)}
          </div>
          <div class="muted" style="margin-top:8px;">
            Expenses: ${fmt(baseExpenses || 0)}<br />
            Labor: ${fmt(laborCost || 0)}
          </div>
        </div>

        <div class="card">
          <b>Profit</b>
          <div style="font-size:24px; font-weight:900; margin-top:10px;">
            ${fmt(profit || 0)}
          </div>
          <div class="muted" style="margin-top:8px;">
            Margin: {fmtPct(profitMargin || 0)}%
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <b>Financial Summary</b>
          <div class="muted" style="margin-top:10px; line-height:1.9;">
            <div><b>Income Received:</b> ${fmt(totalIncome || 0)}</div>
            <div><b>Base Expenses:</b> ${fmt(baseExpenses || 0)}</div>
            <div><b>Labor Hours:</b> {fmt(laborHours || 0)}</div>
            <div><b>Labor Cost:</b> ${fmt(laborCost || 0)}</div>
            <div><b>Total Costs:</b> ${fmt(totalExpenses || 0)}</div>
            <div><b>Profit:</b> ${fmt(profit || 0)}</div>
            <div><b>Profit Margin:</b> {fmtPct(profitMargin || 0)}%</div>
            <div><b>Remaining Contract:</b> ${fmt(remainingContract || 0)}</div>
            <div><b>Retainage Held:</b> ${fmt(retainageHeld || 0)}</div>
          </div>
        </div>

        <div class="card">
          <b>Invoice Summary</b>
          <div class="muted" style="margin-top:10px; line-height:1.9;">
            <div><b>Total Invoiced:</b> ${fmt(invoiceTotal || 0)}</div>
            <div><b>Payments Received:</b> ${fmt(paymentsTotal || 0)}</div>
            <div><b>Unpaid Invoice Balance:</b> ${fmt(unpaidInvoiceBalance || 0)}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <b>Income</b>
          <div class="table-wrap" style="margin-top:10px;">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th class="right">Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {incomeRows.length > 0 ? (
                  incomeRows.map((i) => (
                    <tr>
                      <td>{i.date}</td>
                      <td>{i.description || '\u2014'}</td>
                      <td class="right">${fmt(i.amount || 0)}</td>
                      <td>
                        <form
                          method="post"
                          action={`/delete_income/${i.id}`}
                          onsubmit="return confirm('Delete this income entry?');"
                          style="margin:0;"
                        >
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button type="submit" class="btn">Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={4} class="muted">No income entries.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <b>Expenses</b>
          <div class="table-wrap" style="margin-top:10px;">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th class="right">Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.length > 0 ? (
                  expenseRows.map((e) => (
                    <tr>
                      <td>{e.date}</td>
                      <td>{e.category || '\u2014'}</td>
                      <td>{e.vendor || '\u2014'}</td>
                      <td class="right">${fmt(e.amount || 0)}</td>
                      <td>
                        <form
                          method="post"
                          action={`/delete_expense/${e.id}`}
                          onsubmit="return confirm('Delete this expense entry?');"
                          style="margin:0;"
                        >
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button type="submit" class="btn">Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={5} class="muted">No expenses.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailPage;