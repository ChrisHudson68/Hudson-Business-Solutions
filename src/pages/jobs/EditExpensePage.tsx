import type { FC } from 'hono/jsx';
import type { ParsedReceipt } from '../../db/types.js';

interface EditExpensePageProps {
  expenseId: number;
  job: { id: number; job_name: string | null } | null;
  formData: Record<string, string>;
  currentReceiptFilename?: string | null;
  parsedReceipt?: ParsedReceipt | null;
  receiptOcrError?: string | null;
  pendingReceiptFilename?: string | null;
  receiptReviewPending?: boolean;
  error?: string;
  success?: string;
  csrfToken: string;
}

function confidenceBadge(value?: number | null): string {
  if (typeof value !== 'number') return 'Suggested';
  if (value >= 0.9) return 'High confidence';
  if (value >= 0.78) return 'Medium confidence';
  return 'Low confidence';
}

function hasUsefulSuggestion(parsed?: ParsedReceipt | null): boolean {
  if (!parsed) return false;
  return Boolean(
    parsed.normalizedVendorName ||
      parsed.vendorName ||
      parsed.receiptDate ||
      typeof parsed.subtotal === 'number' ||
      typeof parsed.tax === 'number' ||
      typeof parsed.total === 'number' ||
      parsed.receiptNumber ||
      parsed.suggestedCategory,
  );
}

export const EditExpensePage: FC<EditExpensePageProps> = ({
  expenseId,
  job,
  formData,
  currentReceiptFilename,
  parsedReceipt,
  receiptOcrError,
  pendingReceiptFilename,
  receiptReviewPending,
  error,
  success,
  csrfToken,
}) => {
  const hasParsedData = hasUsefulSuggestion(parsedReceipt);
  const resolvedCategory = formData.category || parsedReceipt?.suggestedCategory || '';
  const resolvedVendor = formData.vendor || parsedReceipt?.normalizedVendorName || parsedReceipt?.vendorName || '';
  const resolvedAmount = formData.amount || (typeof parsedReceipt?.total === 'number' ? parsedReceipt.total.toFixed(2) : '');
  const resolvedDate = formData.date || parsedReceipt?.receiptDate || '';

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

      {receiptReviewPending && parsedReceipt && hasParsedData ? (
        <div
          class="card"
          style="max-width:760px; margin-bottom:14px; border-color:#BFDBFE; background:#EFF6FF; color:#1D4ED8;"
        >
          <div style="font-weight:700; margin-bottom:8px;">New receipt data found</div>
          <div class="muted" style="margin-bottom:12px; color:#1E3A8A;">
            Review the extracted values below, make any corrections you want, then click <b>Save Changes</b> again to replace the current receipt.
          </div>

          <div class="grid cols-2" style="gap:12px;">
            {parsedReceipt.normalizedVendorName || parsedReceipt.vendorName ? (
              <div>
                <div class="muted small">Vendor</div>
                <div>{parsedReceipt.normalizedVendorName || parsedReceipt.vendorName}</div>
                <div class="muted small">{confidenceBadge(parsedReceipt.confidence?.vendorName)}</div>
              </div>
            ) : null}
            {parsedReceipt.suggestedCategory ? (
              <div>
                <div class="muted small">Suggested Category</div>
                <div>{parsedReceipt.suggestedCategory}</div>
                <div class="muted small">{confidenceBadge(parsedReceipt.confidence?.suggestedCategory)}</div>
              </div>
            ) : null}
            {parsedReceipt.receiptDate ? (
              <div>
                <div class="muted small">Date</div>
                <div>{parsedReceipt.receiptDate}</div>
                <div class="muted small">{confidenceBadge(parsedReceipt.confidence?.receiptDate)}</div>
              </div>
            ) : null}
            {typeof parsedReceipt.subtotal === 'number' ? (
              <div>
                <div class="muted small">Subtotal</div>
                <div>${parsedReceipt.subtotal.toFixed(2)}</div>
                <div class="muted small">{confidenceBadge(parsedReceipt.confidence?.subtotal)}</div>
              </div>
            ) : null}
            {typeof parsedReceipt.tax === 'number' ? (
              <div>
                <div class="muted small">Tax</div>
                <div>${parsedReceipt.tax.toFixed(2)}</div>
                <div class="muted small">{confidenceBadge(parsedReceipt.confidence?.tax)}</div>
              </div>
            ) : null}
            {typeof parsedReceipt.total === 'number' ? (
              <div>
                <div class="muted small">Total</div>
                <div>${parsedReceipt.total.toFixed(2)}</div>
                <div class="muted small">{confidenceBadge(parsedReceipt.confidence?.total)}</div>
              </div>
            ) : null}
            {parsedReceipt.receiptNumber ? (
              <div>
                <div class="muted small">Receipt Number</div>
                <div>{parsedReceipt.receiptNumber}</div>
                <div class="muted small">{confidenceBadge(parsedReceipt.confidence?.receiptNumber)}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {receiptOcrError ? (
        <div
          class="card"
          style="max-width:760px; margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;"
        >
          <div style="font-weight:700; margin-bottom:6px;">Receipt OCR notice</div>
          <div>{receiptOcrError}</div>
          <div class="muted small" style="margin-top:8px; color:#92400E;">
            You can still save the expense manually.
          </div>
        </div>
      ) : null}

      {!receiptOcrError && pendingReceiptFilename && !hasParsedData ? (
        <div
          class="card"
          style="max-width:760px; margin-bottom:14px; border-color:#E5E7EB; background:#F9FAFB; color:#374151;"
        >
          <div style="font-weight:700; margin-bottom:6px;">Receipt uploaded successfully</div>
          <div class="muted">
            No usable receipt fields were detected automatically. You can finish editing the expense manually.
          </div>
        </div>
      ) : null}

      <div class="card" style="max-width:760px;">
        <form method="post" action={`/edit_expense/${expenseId}`} enctype="multipart/form-data">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <input type="hidden" name="pending_receipt_filename" value={pendingReceiptFilename || ''} />
          <input type="hidden" name="confirm_receipt_data" value={receiptReviewPending ? '1' : ''} />

          <div class="row">
            <div>
              <label for="category">Category</label>
              <input
                type="text"
                id="category"
                name="category"
                maxLength={120}
                value={resolvedCategory}
              />
              {!formData.category && parsedReceipt?.suggestedCategory ? (
                <div class="muted small" style="margin-top:6px;">
                  Suggested from vendor/receipt pattern.
                </div>
              ) : null}
            </div>
            <div>
              <label for="vendor">Vendor</label>
              <input
                type="text"
                id="vendor"
                name="vendor"
                maxLength={120}
                value={resolvedVendor}
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
                value={resolvedAmount}
              />
            </div>
            <div>
              <label for="date">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                value={resolvedDate}
              />
            </div>
          </div>

          <div>
            <label for="receipt">Replace Receipt</label>
            <input
              type="file"
              id="receipt"
              name="receipt"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.heic,.heif"
            />
            <div class="muted small" style="margin-top:6px;">
              Leave blank to keep the current receipt. Uploading a new receipt will run OCR suggestions before the replacement is finalized.
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
            <button type="submit" class="btn btn-primary">
              {receiptReviewPending ? 'Save Changes' : 'Upload Receipt / Save Changes'}
            </button>
            <a class="btn" href={job ? `/job/${job.id}` : '/jobs'}>Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditExpensePage;
