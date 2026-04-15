import type { FC } from 'hono/jsx';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface JobCostRow {
  job_name: string | null;
  income: number;
  expenses: number;
  labor: number;
}

interface JobCostDashboardPageProps {
  jobs: { id: number; job_name: string | null; client_name: string | null; status: string | null }[];
  selectedJobId: number | null;
  selectedJob: { id: number; job_name: string | null; client_name: string | null; status: string | null } | null;
  overallTotal: number;
  overallLabels: string[];
  overallValues: number[];
  selectedTotal: number;
  selectedLabels: string[];
  selectedValues: number[];
  rows: JobCostRow[];
}

export const JobCostDashboardPage: FC<JobCostDashboardPageProps> = ({
  jobs,
  selectedJobId,
  selectedJob,
  overallTotal,
  overallLabels,
  overallValues,
  selectedTotal,
  selectedLabels,
  selectedValues,
  rows,
}) => {
  const totalIncome = rows.reduce((s, r) => s + (r.income || 0), 0);
  const totalExpenses = rows.reduce((s, r) => s + (r.expenses || 0), 0);
  const totalLabor = rows.reduce((s, r) => s + (r.labor || 0), 0);
  const totalNet = totalIncome - totalExpenses - totalLabor;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Job Cost Breakdown</h1>
          <p>Where income, expenses, and labor are going by job.</p>
        </div>
        <div class="actions">
          <a class="btn" href="/reports">Reports</a>
          <a class="btn" href="/jobs">View Jobs</a>
        </div>
      </div>

      <div class="stat-grid stat-grid-4" style="margin-bottom:16px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Total Income</div>
          <div class="stat-value">${fmt(totalIncome)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value">${fmt(totalExpenses)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Labor</div>
          <div class="stat-value">${fmt(totalLabor)}</div>
        </div>
        <div class="stat-card stat-card-green">
          <div class="stat-label">Net</div>
          <div class="stat-value">${fmt(totalNet)}</div>
          <div class="stat-sub">{rows.length} jobs</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Cost Breakdown by Job</h2>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
            {rows.length} jobs
          </span>
        </div>
        <div class="table-wrap" style="margin:0 -18px -16px;">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th class="right">Income</th>
                <th class="right">Materials/Expenses</th>
                <th class="right">Labor</th>
                <th class="right">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((r) => {
                  const net = (r.income || 0) - (r.expenses || 0) - (r.labor || 0);
                  return (
                    <tr>
                      <td><b>{r.job_name}</b></td>
                      <td class="right">${fmt(r.income || 0)}</td>
                      <td class="right">${fmt(r.expenses || 0)}</td>
                      <td class="right">${fmt(r.labor || 0)}</td>
                      <td class="right">
                        <span class={`badge ${net >= 0 ? 'badge-good' : 'badge-bad'}`}>
                          ${fmt(net)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colspan={5} class="muted">No data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JobCostDashboardPage;
