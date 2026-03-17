import type { FC } from 'hono/jsx';

interface JobRecord {
  id: number;
  job_name: string;
  job_code: string | null;
  client_name: string;
  contract_amount: number | string | null;
  retainage_percent: number | string | null;
  start_date: string | null;
  status: string | null;
}

interface EditJobPageProps {
  job: JobRecord;
  error?: string;
  csrfToken: string;
}

export const EditJobPage: FC<EditJobPageProps> = ({
  job,
  error,
  csrfToken,
}) => {
  const contractAmount =
    job.contract_amount === null || job.contract_amount === undefined
      ? ''
      : String(job.contract_amount);

  const retainagePercent =
    job.retainage_percent === null || job.retainage_percent === undefined
      ? '0'
      : String(job.retainage_percent);

  const startDate = job.start_date ?? '';
  const status = job.status ?? 'Active';

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit Job</h1>
          <p>Update job information and financial settings.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/jobs">Back</a>
        </div>
      </div>

      <div class="card" style="max-width:760px;">
        {error ? (
          <div
            class="badge badge-bad"
            style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;"
          >
            {error}
          </div>
        ) : null}

        <form method="post" action={`/edit_job/${job.id}`}>
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Job Name</label>
          <input name="job_name" value={job.job_name ?? ''} required />

          <label>Job Code</label>
          <input
            name="job_code"
            value={job.job_code ?? ''}
            placeholder="Optional (example: HVAC-102)"
          />

          <label>Client Name</label>
          <input name="client_name" value={job.client_name ?? ''} required />

          <div class="row">
            <div>
              <label>Contract Amount</label>
              <input
                name="contract_amount"
                type="number"
                step="0.01"
                min="0"
                value={contractAmount}
              />
            </div>

            <div>
              <label>Retainage Percent</label>
              <input
                name="retainage_percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={retainagePercent}
              />
            </div>
          </div>

          <div class="row">
            <div>
              <label>Start Date</label>
              <input
                name="start_date"
                type="date"
                value={startDate}
              />
            </div>

            <div>
              <label>Status</label>
              <select name="status">
                <option value="Active" selected={status === 'Active'}>Active</option>
                <option value="Completed" selected={status === 'Completed'}>Completed</option>
                <option value="On Hold" selected={status === 'On Hold'}>On Hold</option>
                <option value="Cancelled" selected={status === 'Cancelled'}>Cancelled</option>
              </select>
            </div>
          </div>

          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditJobPage;