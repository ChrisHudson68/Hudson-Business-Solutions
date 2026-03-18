import type { FC } from 'hono/jsx';

interface JobOption {
  id: number;
  job_name: string;
  client_name: string | null;
}

interface InvoiceRecord {
  id: number;
  job_id: number;
  invoice_number: string;
  date_issued: string;
  due_date: string;
  amount: number;
  notes: string | null;
  attachment_filename?: string | null;
  archived_at?: string | null;
}

interface EditInvoicePageProps {
  invoice: InvoiceRecord;
  jobs: JobOption[];
  csrfToken: string;
  error?: string;
  success?: string;
  formValues?: {
    job_id?: string;
    invoice_number?: string;
    amount?: string;
    date_issued?: string;
    due_date?: string;
    notes?: string;
  };
}

export const EditInvoicePage: FC<EditInvoicePageProps> = ({
  invoice,
  jobs,
  csrfToken,
  error,
  success,
  formValues,
}) => {
  const values = {
    job_id: formValues?.job_id ?? String(invoice.job_id),
    invoice_number: formValues?.invoice_number ?? invoice.invoice_number ?? '',
    amount: formValues?.amount ?? String(invoice.amount ?? ''),
    date_issued: formValues?.date_issued ?? invoice.date_issued ?? '',
    due_date: formValues?.due_date ?? invoice.due_date ?? '',
    notes: formValues?.notes ?? invoice.notes ?? '',
  };

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit Invoice</h1>
          <p class="muted">Update invoice details and manage the attachment.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={`/invoice/${invoice.id}`}>Back to Invoice</a>
        </div>
      </div>

      {invoice.archived_at ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;"
        >
          This invoice is archived. Restore it before making changes.
        </div>
      ) : null}

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

      <div class="card" style="max-width:820px;">
        <form method="post" action={`/edit_invoice/${invoice.id}`} enctype="multipart/form-data">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Job</label>
          <select name="job_id" required disabled={!!invoice.archived_at}>
            {jobs.map((job) => (
              <option value={String(job.id)} selected={values.job_id === String(job.id)}>
                {job.job_name}
                {job.client_name ? ` — ${job.client_name}` : ''}
              </option>
            ))}
          </select>

          <div class="row">
            <div>
              <label>Invoice Number</label>
              <input
                name="invoice_number"
                value={values.invoice_number}
                required
                disabled={!!invoice.archived_at}
              />
            </div>
            <div>
              <label>Amount</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={values.amount}
                required
                disabled={!!invoice.archived_at}
              />
            </div>
          </div>

          <div class="row">
            <div>
              <label>Date Issued</label>
              <input
                name="date_issued"
                type="date"
                value={values.date_issued}
                required
                disabled={!!invoice.archived_at}
              />
            </div>
            <div>
              <label>Due Date</label>
              <input
                name="due_date"
                type="date"
                value={values.due_date}
                required
                disabled={!!invoice.archived_at}
              />
            </div>
          </div>

          <label>Notes</label>
          <textarea name="notes" rows={4} disabled={!!invoice.archived_at}>
            {values.notes}
          </textarea>

          <label>Replace Attachment</label>
          <input
            type="file"
            name="attachment"
            accept=".png,.jpg,.jpeg,.webp,.pdf"
            disabled={!!invoice.archived_at}
          />
          <div class="muted small" style="margin-top:6px;">
            Leave blank to keep the current attachment.
          </div>

          <div class="card" style="margin-top:14px; padding:14px;">
            <b>Current Attachment</b>
            <div style="margin-top:10px;">
              {invoice.attachment_filename ? (
                <div class="actions actions-mobile-stack">
                  <a
                    class="btn"
                    href={`/invoice-attachments/${invoice.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Current Attachment
                  </a>

                  {!invoice.archived_at ? (
                    <form
                      method="post"
                      action={`/delete_invoice_attachment/${invoice.id}`}
                      class="inline-form"
                      onsubmit="return confirm('Remove this attachment from the invoice?');"
                    >
                      <input type="hidden" name="csrf_token" value={csrfToken} />
                      <button class="btn" type="submit">Remove Attachment</button>
                    </form>
                  ) : null}
                </div>
              ) : (
                <div class="muted">No attachment is currently attached.</div>
              )}
            </div>
          </div>

          {!invoice.archived_at ? (
            <div class="actions actions-mobile-stack" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit">Save Changes</button>
              <a class="btn" href={`/invoice/${invoice.id}`}>Cancel</a>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
};

export default EditInvoicePage;