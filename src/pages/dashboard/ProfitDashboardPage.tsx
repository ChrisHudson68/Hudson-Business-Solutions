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
          <p>High-level profitability snapshot.</p>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
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
