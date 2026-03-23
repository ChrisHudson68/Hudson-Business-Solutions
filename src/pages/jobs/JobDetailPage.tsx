import type { FC } from 'hono/jsx';

interface Job {
  id: number;
  job_name: string;
  job_code: string | null;
  job_description: string | null;
  client_name: string | null;
  contract_amount: number | null;
  retainage_percent: number | null;
  start_date: string | null;
  status: string | null;
  archived_at?: string | null;
  source_estimate_id?: number | null;
  source_estimate_number?: string | null;
}

interface IncomeRow {
  id: number;
  amount: number;
  date: string | null;
  description: string | null;
  archived_at?: string | null;
}

interface ExpenseRow {
  id: number;
  category: string | null;
  vendor: string | null;
  amount: number;
  date: string | null;
  receipt_filename?: string | null;
  archived_at?: string | null;
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
  archivedIncomes: IncomeRow[];
  expenses: ExpenseRow[];
  archivedExpenses: ExpenseRow[];
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
  archivedIncomes,
  expenses,
  archivedExpenses,
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
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/jobs">Back</a>
          <a class="btn" href={`/edit_job/${job.id}`}>Edit</a>
          {job.archived_at ? (
            <form method="post" action={`/restore_job/${job.id}`} class="inline-form">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <button class="btn" type="submit">Restore</button>
            </form>
          ) : (
            <form method="post" action={`/archive_job/${job.id}`} class="inline-form">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <button class="btn" type="submit">Archive</button>
            </form>
          )}
        </div>
      </div>

      {job.source_estimate_id ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#BFDBFE; background:#EFF6FF; color:#1E3A8A;"
        >
          <div style="font-weight:800; margin-bottom:6px;">Created from approved estimate</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <span>
              This job was created automatically from{' '}
              <b>{job.source_estimate_number || `Estimate #${job.source_estimate_id}`}</b>.
            </span>
            <a class="btn" href={`/estimate/${job.source_estimate_id}`}>Open Estimate</a>
          </div>
        </div>
      ) : null}

      {job.archived_at ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;"
        >
          This job is archived. It is preserved for history and can be restored.
        </div>
      ) : null}

      <div class="grid grid-4 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Contract</div>
          <div class="metric-value">${formatMoney(Number(job.contract_amount || 0))}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Income</div>
          <div class="metric-value">${formatMoney(totalIncome || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Costs</div>
          <div class="metric-value">${formatMoney(totalCosts || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Profit</div>
          <div class="metric-value">${formatMoney(profit || 0)}</div>
        </div>
      </div>

      <div class="grid grid-3 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Expenses</div>
          <div class="metric-value">${formatMoney(totalExpenses || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Labor</div>
          <div class="metric-value">${formatMoney(totalLabor || 0)}</div>
        </div>

        <div class="card mobile-kpi-card">
          <div class="metric-label">Retainage Held</div>
          <div class="metric-value">${formatMoney(retainageHeld || 0)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-bottom:14px;">
        <div class="card">
          <b>Job Info</b>
          <div class="mobile-info-list">
            <div class="mobile-info-row">
              <span class="mobile-info-label">Client</span>
              <span class="mobile-info-value">{job.client_name || '—'}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Job Code</span>
              <span class="mobile-info-value">{job.job_code || '—'}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Status</span>
              <span class="mobile-info-value">{job.status || '—'}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Start Date</span>
              <span class="mobile-info-value">{job.start_date || '—'}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Retainage %</span>
              <span class="mobile-info-value">{Number(job.retainage_percent || 0).toFixed(2)}%</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Source Estimate</span>
              <span class="mobile-info-value">
                {job.source_estimate_number || (job.source_estimate_id ? `Estimate #${job.source_estimate_id}` : '—')}
              </span>
            </div>
          </div>
        </div>

        <div class="card">
          <b>Job Description</b>
          <div class="muted" style="white-space:pre-wrap; margin-top:12px;">
            {job.job_description || 'No job description entered yet.'}
          </div>
        </div>
      </div>

      <div class="card">
        <b>Actions</b>
        <div class="actions actions-mobile-stack" style="margin-top:12px;">
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

      <div class="grid grid-2" style="margin-top:14px; align-items:start;">
        <div class="card">
          <div class="page-head" style="margin-bottom:10px;">
            <div>
              <b>Income</b>
            </div>
            {!job.archived_at ? <a class="btn" href={`/add_income/${job.id}`}>Add Income</a> : null}
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {incomes.length ? incomes.map((row) => (
                  <tr>
                    <td>{row.date || '—'}</td>
                    <td>{row.description || '—'}</td>
                    <td>${formatMoney(Number(row.amount || 0))}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colspan={3} class="muted">No income recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="page-head" style="margin-bottom:10px;">
            <div>
              <b>Expenses</b>
            </div>
            {!job.archived_at ? <a class="btn" href={`/add_expense/${job.id}`}>Add Expense</a> : null}
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length ? expenses.map((row) => (
                  <tr>
                    <td>{row.date || '—'}</td>
                    <td>{row.category || '—'}</td>
                    <td>{row.vendor || '—'}</td>
                    <td>${formatMoney(Number(row.amount || 0))}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colspan={4} class="muted">No expenses recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <b>Labor Time</b>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Hours</th>
                <th>Labor Cost</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.length ? timeEntries.map((row) => (
                <tr>
                  <td>{row.date}</td>
                  <td>{row.employee_name}</td>
                  <td>{Number(row.hours || 0).toFixed(2)}</td>
                  <td>${formatMoney(Number(row.labor_cost || 0))}</td>
                  <td>{row.note || '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colspan={5} class="muted">No labor time recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(archivedIncomes.length || archivedExpenses.length) ? (
        <div class="grid grid-2" style="margin-top:14px; align-items:start;">
          <div class="card">
            <b>Archived Income</b>
            <div class="table-wrap" style="margin-top:10px;">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedIncomes.length ? archivedIncomes.map((row) => (
                    <tr>
                      <td>{row.date || '—'}</td>
                      <td>{row.description || '—'}</td>
                      <td>${formatMoney(Number(row.amount || 0))}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colspan={3} class="muted">No archived income.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <b>Archived Expenses</b>
            <div class="table-wrap" style="margin-top:10px;">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Vendor</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedExpenses.length ? archivedExpenses.map((row) => (
                    <tr>
                      <td>{row.date || '—'}</td>
                      <td>{row.category || '—'}</td>
                      <td>{row.vendor || '—'}</td>
                      <td>${formatMoney(Number(row.amount || 0))}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colspan={4} class="muted">No archived expenses.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default JobDetailPage;
