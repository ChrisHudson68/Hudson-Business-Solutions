import type { FC } from 'hono/jsx';

interface Job {
  id: number;
  job_name: string;
  job_code: string | null;
  client_name: string | null;
  contract_amount: number | null;
  retainage_percent: number | null;
  start_date: string | null;
  status: string | null;
  archived_at?: string | null;
}

interface IncomeRow {
  id: number;
  amount: number;
  date: string | null;
  description: string | null;
}

interface ExpenseRow {
  id: number;
  category: string | null;
  vendor: string | null;
  amount: number;
  date: string | null;
  receipt_filename?: string | null;
}

interface TimeRow {
  id: number;
  employee_name: string;
  date: string;
  hours: number;
  labor_cost: number;
  note: string | null;
}

interface JobDetailPageProps {
  job: Job;
  incomes: IncomeRow[];
  expenses: ExpenseRow[];
  timeEntries: TimeRow[];
  totalIncome: number;
  totalExpenses: number;
  totalLabor: number;
  totalCosts: number;
  profit: number;
  retainageHeld: number;
  csrfToken: string;
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const JobDetailPage: FC<JobDetailPageProps> = ({
  job,
  incomes,
  expenses,
  timeEntries,
  totalIncome,
  totalExpenses,
  totalLabor,
  totalCosts,
  profit,
  retainageHeld,
  csrfToken,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{job.job_name}</h1>
          <p class="muted">
            {job.client_name || 'No client'} • {job.job_code || 'No job code'}
          </p>
        </div>
        <div class="actions">
          <a class="btn" href="/jobs">Back</a>
          <a class="btn" href={`/edit_job/${job.id}`}>Edit</a>
          {job.archived_at ? (
            <form method="post" action={`/restore_job/${job.id}`} style="display:inline;">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <button class="btn" type="submit">Restore</button>
            </form>
          ) : (
            <form method="post" action={`/archive_job/${job.id}`} style="display:inline;">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <button class="btn" type="submit">Archive</button>
            </form>
          )}
        </div>
      </div>

      {job.archived_at ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;"
        >
          This job is archived. It is preserved for history and can be restored.
        </div>
      ) : null}

      <div class="grid grid-4" style="margin-bottom:14px;">
        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Contract</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatMoney(Number(job.contract_amount || 0))}
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Income</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatMoney(totalIncome || 0)}
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Costs</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatMoney(totalCosts || 0)}
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Profit</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatMoney(profit || 0)}
          </div>
        </div>
      </div>

      <div class="grid grid-3" style="margin-bottom:14px;">
        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Expenses</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatMoney(totalExpenses || 0)}
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Labor</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatMoney(totalLabor || 0)}
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-weight:900; font-size:12px;">Retainage Held</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">
            ${formatMoney(retainageHeld || 0)}
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:14px;">
        <div class="card">
          <b>Job Info</b>
          <div class="muted" style="margin-top:10px; line-height:1.8;">
            <div><b>Client:</b> {job.client_name || '—'}</div>
            <div><b>Job Code:</b> {job.job_code || '—'}</div>
            <div><b>Status:</b> {job.status || '—'}</div>
            <div><b>Start Date:</b> {job.start_date || '—'}</div>
            <div><b>Retainage %:</b> {Number(job.retainage_percent || 0).toFixed(2)}%</div>
          </div>
        </div>

        <div class="card">
          <b>Actions</b>
          <div class="actions" style="margin-top:12px; flex-wrap:wrap;">
            {job.archived_at ? (
              <span class="muted">Restore this job to add new income or expenses.</span>
            ) : (
              <>
                <a class="btn btn-primary" href={`/add_income/${job.id}`}>Add Income</a>
                <a class="btn" href={`/add_expense/${job.id}`}>Add Expense</a>
              </>
            )}
          </div>
          <p class="muted" style="margin-top:10px;">
            Use these to keep job costing and cash flow accurate.
          </p>
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
                  <th class="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {incomes.length > 0 ? (
                  incomes.map((row) => (
                    <tr>
                      <td>{row.date || '—'}</td>
                      <td>{row.description || '—'}</td>
                      <td class="right">${formatMoney(Number(row.amount || 0))}</td>
                      <td class="right">
                        {job.archived_at ? (
                          <span class="muted">Locked</span>
                        ) : (
                          <form
                            method="post"
                            action={`/delete_income/${row.id}`}
                            style="display:inline;"
                            onsubmit="return confirm('Delete this income entry?');"
                          >
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button class="btn" type="submit">Delete</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={4} class="muted">No income records yet.</td>
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
                  <th class="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length > 0 ? (
                  expenses.map((row) => (
                    <tr>
                      <td>{row.date || '—'}</td>
                      <td>{row.category || '—'}</td>
                      <td>{row.vendor || '—'}</td>
                      <td class="right">${formatMoney(Number(row.amount || 0))}</td>
                      <td class="right">
                        {job.archived_at ? (
                          <span class="muted">Locked</span>
                        ) : (
                          <form
                            method="post"
                            action={`/delete_expense/${row.id}`}
                            style="display:inline;"
                            onsubmit="return confirm('Delete this expense entry?');"
                          >
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button class="btn" type="submit">Delete</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colspan={5} class="muted">No expense records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <b>Labor Entries</b>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th class="right">Hours</th>
                <th class="right">Labor Cost</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.length > 0 ? (
                timeEntries.map((row) => (
                  <tr>
                    <td>{row.date}</td>
                    <td>{row.employee_name}</td>
                    <td class="right">{Number(row.hours || 0).toFixed(2)}</td>
                    <td class="right">${formatMoney(Number(row.labor_cost || 0))}</td>
                    <td>{row.note || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={5} class="muted">No labor entries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobDetailPage;