import type { FC } from 'hono/jsx';

interface MergeJobRow {
  id: number;
  job_name: string;
  job_code: string | null;
  client_name: string | null;
  contract_amount: number;
  status: string | null;
  source_estimate_number: string | null;
  scope_of_work: string | null;
}

interface JobMergePageProps {
  jobs: MergeJobRow[];
  csrfToken: string;
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const JobMergePage: FC<JobMergePageProps> = ({ jobs, csrfToken }) => {
  const totalContract = jobs.reduce((sum, j) => sum + Number(j.contract_amount || 0), 0);

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Merge Jobs</h1>
          <p class="muted">
            Select a primary job — all time entries, expenses, invoices, and estimates from the other
            jobs will be moved into it. Secondary jobs will be archived after merging.
          </p>
        </div>
        <div class="actions">
          <a class="btn" href="/jobs">Cancel</a>
        </div>
      </div>

      <div class="stat-grid stat-grid-4" style="margin-bottom:14px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Jobs Selected</div>
          <div class="stat-value">{jobs.length}</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Combined Contract Value</div>
          <div class="stat-value">${fmt(totalContract)}</div>
        </div>
      </div>

      <form method="post" action="/jobs/merge">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        {jobs.map((job) => (
          <input type="hidden" name="job_ids" value={String(job.id)} />
        ))}

        <div class="card" style="margin-bottom:14px;">
          <h3 style="margin-top:0;">Select Primary Job</h3>
          <p class="muted" style="margin-bottom:14px;">
            The primary job keeps its name and absorbs all data from the others. The combined
            contract value (${fmt(totalContract)}) and merged scope of work will be saved to it.
          </p>
          <div style="display:grid; gap:10px;">
            {jobs.map((job, i) => (
              <label
                style="display:flex; align-items:flex-start; gap:12px; border:1px solid #E5EAF2; border-radius:12px; padding:14px; cursor:pointer; background:#fff;"
              >
                <input
                  type="radio"
                  name="primary_job_id"
                  value={String(job.id)}
                  required
                  checked={i === 0}
                  style="margin-top:3px; flex:0 0 auto;"
                />
                <div style="flex:1;">
                  <div style="font-weight:700; font-size:15px;">{job.job_name}</div>
                  <div class="muted" style="font-size:12px; margin-top:2px;">
                    {job.job_code ? `${job.job_code} · ` : ''}{job.client_name || 'No client'} · {job.status || 'Unknown'}
                    {job.source_estimate_number ? ` · ${job.source_estimate_number}` : ''}
                  </div>
                  <div style="font-weight:700; color:#1E3A5F; margin-top:6px;">
                    ${fmt(Number(job.contract_amount || 0))}
                  </div>
                  {job.scope_of_work ? (
                    <div class="muted" style="margin-top:6px; font-size:12px; white-space:pre-wrap; max-height:60px; overflow:hidden;">
                      {job.scope_of_work.slice(0, 200)}{job.scope_of_work.length > 200 ? '…' : ''}
                    </div>
                  ) : null}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div class="card" style="margin-bottom:14px; border-color:#FEF3C7; background:#FFFBEB;">
          <div style="font-weight:700; color:#92400E; margin-bottom:6px;">What will happen</div>
          <ul style="margin:0; padding-left:18px; color:#78350F; font-size:14px; line-height:1.8;">
            <li>The combined contract value of <b>${fmt(totalContract)}</b> will be set on the primary job</li>
            <li>All scope of work text from each linked estimate will be combined</li>
            <li>All time entries, expenses, invoices, and income will move to the primary job</li>
            <li>All linked estimates will point to the primary job</li>
            <li>Secondary jobs will be archived (not deleted — you can still view them)</li>
          </ul>
        </div>

        <div class="actions">
          <a class="btn" href="/jobs">Cancel</a>
          <button class="btn btn-primary" type="submit">Merge Jobs</button>
        </div>
      </form>
    </div>
  );
};

export default JobMergePage;
