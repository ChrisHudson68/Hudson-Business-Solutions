import type { FC } from 'hono/jsx';

interface AddIncomePageProps {
  jobId: number;
  job: { id: number; job_name: string | null } | null;
  formData: Record<string, string>;
  error?: string;
  csrfToken: string;
}

export const AddIncomePage: FC<AddIncomePageProps> = ({
  jobId,
  job,
  formData,
  error,
  csrfToken,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Add Income</h1>
          <p class="muted">
            {job ? `Record income for ${job.job_name}.` : 'Record income for this job.'}
          </p>
        </div>
        <div class="actions">
          <a class="btn" href={`/job/${jobId}`}>Back to Job</a>
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

        <form method="post" action={`/add_income/${jobId}`}>
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <div class="row">
            <div>
              <label for="amount">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                id="amount"
                name="amount"
                required
                value={formData.amount || ''}
              />
            </div>
            <div>
              <label for="date">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                required
                value={formData.date || ''}
              />
            </div>
          </div>

          <div>
            <label for="description">Description</label>
            <input
              type="text"
              id="description"
              name="description"
              maxLength={255}
              value={formData.description || ''}
            />
          </div>

          <div class="actions" style="margin-top:16px;">
            <button type="submit" class="btn btn-primary">Save Income</button>
            <a class="btn" href={`/job/${jobId}`}>Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddIncomePage;