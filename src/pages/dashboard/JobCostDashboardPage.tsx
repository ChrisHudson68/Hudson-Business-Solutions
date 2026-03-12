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
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Job Cost Breakdown</h1>
          <p>Where money is going by job.</p>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
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
