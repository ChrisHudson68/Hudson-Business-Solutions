import type { FC } from 'hono/jsx';

interface MonthlyBillsPageProps {
  bills: Array<{
    id: number;
    name: string;
    category: string | null;
    vendor: string | null;
    amount: number;
    due_day: number;
    effective_start_date: string;
    end_date: string | null;
    active: number;
    notes: string | null;
    archived_at: string | null;
    next_due_date: string | null;
  }>;
  formData: {
    name: string;
    category: string;
    vendor: string;
    amount: string;
    due_day: string;
    effective_start_date: string;
    end_date: string;
    active: string;
    notes: string;
  };
  editingBillId?: number | null;
  error?: string;
  success?: string;
  csrfToken: string;
  canManage: boolean;
  summary: {
    activeCount: number;
    archivedCount: number;
    scheduledThisMonth: number;
    nextThirtyDays: number;
  };
}

function fmtMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dueDayLabel(day: number): string {
  const suffix = day % 10 === 1 && day % 100 !== 11
    ? 'st'
    : day % 10 === 2 && day % 100 !== 12
      ? 'nd'
      : day % 10 === 3 && day % 100 !== 13
        ? 'rd'
        : 'th';
  return `${day}${suffix}`;
}

export const MonthlyBillsPage: FC<MonthlyBillsPageProps> = ({
  bills,
  formData,
  editingBillId,
  error,
  success,
  csrfToken,
  canManage,
  summary,
}) => {
  const isEditing = Number(editingBillId || 0) > 0;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Monthly Bills</h1>
          <p class="muted">Track recurring overhead like rent, internet, insurance, software, and utilities. Active bills are automatically included in monthly expense reporting.</p>
        </div>
      </div>

      <div class="grid grid-4" style="margin-bottom:14px;">
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Active Bills</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{summary.activeCount}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Scheduled This Month</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{fmtMoney(summary.scheduledThisMonth)}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Next 30 Days</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{fmtMoney(summary.nextThirtyDays)}</div>
        </div>
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Archived</div>
          <div style="font-size:28px; font-weight:900; margin-top:8px;">{summary.archivedCount}</div>
        </div>
      </div>

      {error ? (
        <div class="card" style="margin-bottom:14px; border-color:#FCA5A5; background:#FEF2F2; color:#991B1B;">
          <b>Unable to save monthly bill.</b>
          <div style="margin-top:6px;">{error}</div>
        </div>
      ) : null}

      {success ? (
        <div class="card" style="margin-bottom:14px; border-color:#86EFAC; background:#F0FDF4; color:#166534;">
          <b>Success</b>
          <div style="margin-top:6px;">{success}</div>
        </div>
      ) : null}

      {canManage ? (
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head">
            <b>{isEditing ? 'Edit Monthly Bill' : 'Add Monthly Bill'}</b>
            {isEditing ? <a class="btn" href="/monthly-bills">Cancel Edit</a> : null}
          </div>

          <form method="post" action={isEditing ? `/monthly-bills/${editingBillId}/update` : '/monthly-bills'}>
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <div class="row">
              <div>
                <label>Bill Name</label>
                <input type="text" name="name" value={formData.name} placeholder="Office Rent" required />
              </div>
              <div>
                <label>Category</label>
                <input type="text" name="category" value={formData.category} placeholder="Rent / Utilities / Software" />
              </div>
            </div>

            <div class="row">
              <div>
                <label>Vendor</label>
                <input type="text" name="vendor" value={formData.vendor} placeholder="Landlord, Utility Provider, Vendor" />
              </div>
              <div>
                <label>Amount</label>
                <input type="number" name="amount" value={formData.amount} step="0.01" min="0.01" required />
              </div>
              <div>
                <label>Due Day Each Month</label>
                <input type="number" name="due_day" value={formData.due_day} min="1" max="31" required />
              </div>
            </div>

            <div class="row">
              <div>
                <label>Effective Start Date</label>
                <input type="date" name="effective_start_date" value={formData.effective_start_date} required />
              </div>
              <div>
                <label>Optional End Date</label>
                <input type="date" name="end_date" value={formData.end_date} />
              </div>
              <div>
                <label>Status</label>
                <select name="active">
                  <option value="1" selected={formData.active !== '0'}>Active</option>
                  <option value="0" selected={formData.active === '0'}>Inactive</option>
                </select>
              </div>
            </div>

            <label>Notes</label>
            <textarea name="notes" rows={3} placeholder="Optional notes like account reference, autopay, or reminder details.">{formData.notes}</textarea>

            <div class="actions actions-mobile-stack" style="margin-top:14px;">
              <button class="btn btn-primary" type="submit">{isEditing ? 'Save Monthly Bill' : 'Add Monthly Bill'}</button>
              {isEditing ? <a class="btn" href="/monthly-bills">Back to List</a> : null}
            </div>
          </form>
        </div>
      ) : null}

      <div class="card">
        <div class="card-head">
          <b>Recurring Monthly Bills</b>
          <span class="badge">{bills.length} total</span>
        </div>

        <div class="table-wrap table-wrap-tight">
          <table class="table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Category / Vendor</th>
                <th>Schedule</th>
                <th class="right">Amount</th>
                <th>Status</th>
                <th class="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.length > 0 ? bills.map((bill) => (
                <tr>
                  <td>
                    <div><b>{bill.name}</b></div>
                    {bill.notes ? <div class="muted small" style="margin-top:4px;">{bill.notes}</div> : null}
                  </td>
                  <td>
                    <div>{bill.category || <span class="muted">Uncategorized</span>}</div>
                    <div class="muted small" style="margin-top:4px;">{bill.vendor || 'No vendor listed'}</div>
                  </td>
                  <td>
                    <div>Every month on the {dueDayLabel(bill.due_day)}</div>
                    <div class="muted small" style="margin-top:4px;">Starts {bill.effective_start_date}{bill.end_date ? ` • Ends ${bill.end_date}` : ''}</div>
                    <div class="muted small" style="margin-top:4px;">Next due: {bill.next_due_date || 'Not scheduled'}</div>
                  </td>
                  <td class="right"><b>{fmtMoney(bill.amount)}</b></td>
                  <td>
                    {bill.archived_at ? (
                      <span class="badge">Archived</span>
                    ) : bill.active ? (
                      <span class="badge badge-good">Active</span>
                    ) : (
                      <span class="badge badge-warn">Inactive</span>
                    )}
                  </td>
                  <td class="right">
                    <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                      {canManage && !bill.archived_at ? <a class="btn" href={`/monthly-bills?edit=${bill.id}`}>Edit</a> : null}
                      {canManage && !bill.archived_at ? (
                        <form method="post" action={`/monthly-bills/${bill.id}/archive`}>
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit">Archive</button>
                        </form>
                      ) : null}
                      {canManage && bill.archived_at ? (
                        <form method="post" action={`/monthly-bills/${bill.id}/restore`}>
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit">Restore</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colspan={6} class="muted">No monthly bills added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyBillsPage;
