import type { FC } from 'hono/jsx';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ProfitRow {
  id: number;
  job_name: string | null;
  client: string | null;
  status: string;
  contract: number;
  income: number;
  expenses: number;
  profit: number;
  margin: number;
}

interface ProfitDashboardPageProps {
  totalIncome: number;
  totalExpenses: number;
  totalProfit: number;
  avgMargin: number;
  activeContractValue: number;
  profitableJobs: number;
  losingJobs: number;
  topProfit: ProfitRow[];
  topMargin: ProfitRow[];
  worstProfit: ProfitRow[];
  rows: ProfitRow[];
}

export const ProfitDashboardPage: FC<ProfitDashboardPageProps> = ({
  totalIncome,
  totalExpenses,
  totalProfit,
  avgMargin,
  activeContractValue,
  profitableJobs,
  losingJobs,
  topProfit,
  topMargin,
  worstProfit,
  rows,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Profit Dashboard</h1>
          <p>High-level profitability snapshot across all jobs.</p>
        </div>
        <div class="actions">
          <a class="btn" href="/reports">Reports</a>
          <a class="btn" href="/jobs">View Jobs</a>
        </div>
      </div>

      <div class="stat-grid stat-grid-4" style="margin-bottom:16px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Total Income</div>
          <div class="stat-value">${fmt(totalIncome || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Expenses</div>
          <div class="stat-value">${fmt(totalExpenses || 0)}</div>
        </div>
        <div class="stat-card stat-card-green">
          <div class="stat-label">Total Profit</div>
          <div class="stat-value">${fmt(totalProfit || 0)}</div>
          <div class="stat-sub">Avg margin {fmt(avgMargin || 0)}%</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Active Contract Value</div>
          <div class="stat-value">${fmt(activeContractValue || 0)}</div>
          <div class="stat-sub">{profitableJobs} profitable · {losingJobs} losing</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>All Jobs — Profit Summary</h2>
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
                <th class="right">Expenses</th>
                <th class="right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((r) => {
                  const p = (r.income || 0) - (r.expenses || 0);
                  return (
                    <tr>
                      <td><b>{r.job_name}</b></td>
                      <td class="right">${fmt(r.income || 0)}</td>
                      <td class="right">${fmt(r.expenses || 0)}</td>
                      <td class="right">
                        <span class={`badge ${p >= 0 ? 'badge-good' : 'badge-bad'}`}>
                          ${fmt(p)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colspan={4} class="muted">No data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProfitDashboardPage;
