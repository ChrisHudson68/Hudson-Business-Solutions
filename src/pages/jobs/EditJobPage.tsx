import type { FC } from 'hono/jsx';

interface EditJobPageProps {
  jobId: number;
  formData: {
    job_name?: string;
    job_code?: string;
    client_name?: string;
    sold_by?: string;
    commission_percent?: string;
    job_description?: string;
    contract_amount?: string;
    retainage_percent?: string;
    start_date?: string;
    status?: string;
  };
  error?: string;
  csrfToken: string;
}

export const EditJobPage: FC<EditJobPageProps> = ({
  jobId,
  formData,
  error,
  csrfToken,
}) => {
  const values = {
    job_name: formData?.job_name ?? '',
    job_code: formData?.job_code ?? '',
    client_name: formData?.client_name ?? '',
    sold_by: formData?.sold_by ?? '',
    commission_percent: formData?.commission_percent ?? '0',
    job_description: formData?.job_description ?? '',
    contract_amount: formData?.contract_amount ?? '',
    retainage_percent: formData?.retainage_percent ?? '0',
    start_date: formData?.start_date ?? '',
    status: formData?.status ?? 'Active',
  };

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

        <form method="post" action={`/edit_job/${jobId}`}>
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Job Name</label>
          <input name="job_name" value={values.job_name} required />

          <label>Job Code</label>
          <input
            name="job_code"
            value={values.job_code}
            placeholder="Optional (example: HVAC-102)"
          />

          <label>Client Name</label>
          <input name="client_name" value={values.client_name} required />

          <div class="row">
            <div>
              <label>Sold By</label>
              <input
                name="sold_by"
                value={values.sold_by}
                placeholder="Optional salesperson or estimator"
              />
            </div>

            <div>
              <label>Commission Percent</label>
              <input
                name="commission_percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={values.commission_percent}
              />
            </div>
          </div>

          <label>Job Description</label>
          <textarea
            name="job_description"
            rows={6}
            placeholder="Describe the work for this job"
          >
            {values.job_description}
          </textarea>

          <div class="row">
            <div>
              <label>Contract Amount</label>
              <input
                name="contract_amount"
                type="number"
                step="0.01"
                min="0"
                value={values.contract_amount}
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
                value={values.retainage_percent}
              />
            </div>
          </div>

          <div class="row">
            <div>
              <label>Start Date</label>
              <input
                name="start_date"
                type="date"
                value={values.start_date}
              />
            </div>

            <div>
              <label>Status</label>
              <select name="status">
                <option value="Active" selected={values.status === 'Active'}>Active</option>
                <option value="Completed" selected={values.status === 'Completed'}>Completed</option>
                <option value="On Hold" selected={values.status === 'On Hold'}>On Hold</option>
                <option value="Cancelled" selected={values.status === 'Cancelled'}>Cancelled</option>
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
