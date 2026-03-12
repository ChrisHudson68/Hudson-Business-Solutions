import type { FC } from 'hono/jsx';

interface Job {
  id: number;
  job_name: string;
  client_name: string | null;
}

interface TenantInfo {
  id: number;
  name: string;
  subdomain: string;
  logo_path: string | null;
  invoice_prefix: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
}

interface AddInvoiceFormValues {
  job_id: string;
  invoice_number: string;
  amount: string;
  date_issued: string;
  due_date: string;
  notes: string;
}

interface AddInvoicePageProps {
  jobs: Job[];
  prefillJobId: number | null;
  suggestedInvoiceNumber: string;
  tenant: TenantInfo;
  csrfToken: string;
  error?: string;
  formValues?: Partial<AddInvoiceFormValues>;
}

export const AddInvoicePage: FC<AddInvoicePageProps> = ({
  jobs,
  prefillJobId,
  suggestedInvoiceNumber,
  tenant,
  csrfToken,
  error,
  formValues,
}) => {
  const selectedJobId = formValues?.job_id ?? (prefillJobId ? String(prefillJobId) : '');
  const invoiceNumber = formValues?.invoice_number ?? suggestedInvoiceNumber ?? '';
  const amount = formValues?.amount ?? '';
  const dateIssued = formValues?.date_issued ?? '';
  const dueDate = formValues?.due_date ?? '';
  const notes = formValues?.notes ?? '';

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Create Invoice</h1>
          <p>Generate a new invoice for a job.</p>
        </div>
        <div class="actions">
          <a class="btn" href="/invoices">Back</a>
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

      <div class="grid grid-2">
        <div class="card">
          <h3 style="margin-top:0;">Invoice Details</h3>

          <form method="post">
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <label>Job</label>
            <select name="job_id" required>
              <option value="">Select a job</option>
              {jobs.map((j) => (
                <option value={String(j.id)} selected={selectedJobId === String(j.id)}>
                  {j.job_name}
                  {j.client_name ? ` — ${j.client_name}` : ''}
                </option>
              ))}
            </select>

            <div class="row">
              <div>
                <label>Invoice Number</label>
                <input name="invoice_number" value={invoiceNumber} required />
              </div>
              <div>
                <label>Amount</label>
                <input name="amount" type="number" step="0.01" min="0.01" value={amount} required />
              </div>
            </div>

            <div class="row">
              <div>
                <label>Date Issued</label>
                <input name="date_issued" type="date" value={dateIssued} required />
              </div>
              <div>
                <label>Due Date</label>
                <input name="due_date" type="date" value={dueDate} required />
              </div>
            </div>

            <label>Notes</label>
            <textarea name="notes" rows={4} placeholder="Optional">
              {notes}
            </textarea>

            <div style="margin-top:16px;" class="actions">
              <button class="btn btn-primary" type="submit">Create Invoice</button>
            </div>
          </form>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Billing Profile</h3>

          <div style="font-weight:800; font-size:18px; margin-bottom:10px;">
            {tenant.name || 'Company'}
          </div>

          {tenant.logo_path ? (
            <div style="margin-bottom:14px;">
              <img
                src={tenant.logo_path}
                alt="Company Logo"
                style="max-height:80px; border:1px solid #E5EAF2; border-radius:12px; padding:8px; background:white;"
              />
            </div>
          ) : null}

          <div class="muted" style="line-height:1.6;">
            {tenant.company_address ? (
              <div>
                <strong>Address:</strong> {tenant.company_address}
              </div>
            ) : null}
            {tenant.company_email ? (
              <div>
                <strong>Email:</strong> {tenant.company_email}
              </div>
            ) : null}
            {tenant.company_phone ? (
              <div>
                <strong>Phone:</strong> {tenant.company_phone}
              </div>
            ) : null}
            <div>
              <strong>Invoice Prefix:</strong> {tenant.invoice_prefix || 'INV'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddInvoicePage;