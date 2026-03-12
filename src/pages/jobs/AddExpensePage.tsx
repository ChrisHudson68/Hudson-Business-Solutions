import type { FC } from 'hono/jsx';

interface AddExpensePageProps {
  jobId: number;
  job: { id: number; job_name: string | null } | null;
  formData: Record<string, string>;
  error?: string;
  csrfToken: string;
}

export const AddExpensePage: FC<AddExpensePageProps> = ({
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
          <h1>Add Expense</h1>
          <p class="muted">
            {job ? `Record an expense for ${job.job_name}.` : 'Record an expense for this job.'}
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

        <form method="post" action={`/add_expense/${jobId}`} enctype="multipart/form-data">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <div class="row">
            <div>
              <label for="category">Category</label>
              <input
                type="text"
                id="category"
                name="category"
                required
                maxLength={120}
                value={formData.category || ''}
              />
            </div>
            <div>
              <label for="vendor">Vendor</label>
              <input
                type="text"
                id="vendor"
                name="vendor"
                maxLength={120}
                value={formData.vendor || ''}
              />
            </div>
          </div>

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
            <label for="receipt">Receipt</label>
            <input
              type="file"
              id="receipt"
              name="receipt"
              accept=".png,.jpg,.jpeg,.webp,.pdf"
            />
          </div>

          <div class="actions" style="margin-top:16px;">
            <button type="submit" class="btn btn-primary">Save Expense</button>
            <a class="btn" href={`/job/${jobId}`}>Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpensePage;