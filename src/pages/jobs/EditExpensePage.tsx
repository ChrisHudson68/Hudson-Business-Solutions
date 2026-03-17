import type { FC } from 'hono/jsx';

interface EditExpensePageProps {
  expenseId: number;
  job: { id: number; job_name: string | null } | null;
  formData: Record<string, string>;
  currentReceiptFilename?: string | null;
  error?: string;
  success?: string;
  csrfToken: string;
}

export const EditExpensePage: FC<EditExpensePageProps> = ({
  expenseId,
  job,
  formData,
  currentReceiptFilename,
  error,
  success,
  csrfToken,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit Expense</h1>
          <p class="muted">
            {job ? `Update an expense for ${job.job_name}.` : 'Update this expense.'}
          </p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={job ? `/job/${job.id}` : '/jobs'}>Back to Job</a>
        </div>
      </div>

      {error ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;"
        >
          {success}
        </div>
      ) : null}

      <div class="card" style="max-width:760px;">
        <form method="post" action={`/edit_expense/${expenseId}`} enctype="multipart/form-data">
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
            <label for="receipt">Replace Receipt</label>
            <input
              type="file"
              id="receipt"
              name="receipt"
              accept=".png,.jpg,.jpeg,.webp,.pdf"
            />
            <div class="muted small" style="margin-top:6px;">
              Leave blank to keep the current receipt.
            </div>
          </div>

          <div class="card" style="margin-top:14px; padding:14px;">
            <b>Current Receipt</b>
            <div style="margin-top:10px;">
              {currentReceiptFilename ? (
                <div class="actions actions-mobile-stack">
                  <a
                    class="btn"
                    href={`/expense-receipts/${expenseId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Current Receipt
                  </a>

                  <form
                    method="post"
                    action={`/delete_expense_receipt/${expenseId}`}
                    class="inline-form"
                    onsubmit="return confirm('Remove this receipt from the expense?');"
                  >
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <button class="btn" type="submit">Remove Receipt</button>
                  </form>
                </div>
              ) : (
                <div class="muted">No receipt is currently attached.</div>
              )}
            </div>
          </div>

          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <a class="btn" href={job ? `/job/${job.id}` : '/jobs'}>Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditExpensePage;