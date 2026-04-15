import type { FC } from 'hono/jsx';

interface FleetSchedulePageProps {
  rows: Array<{
    vehicle_id: number;
    vehicle_display_name: string;
    current_odometer: number | null;
    reminder: {
      category: string;
      label: string;
      dueAtDate: string | null;
      dueAtOdometer: number | null;
      daysRemaining: number | null;
      milesRemaining: number | null;
      isDue: boolean;
      reason: string;
    };
    expiringDocuments: Array<{
      id: number;
      title: string;
      document_type: string;
      expiration_date: string | null;
    }>;
  }>;
  getDocumentTypeLabel: (value: string | null) => string;
  csrfToken: string;
  canManage: boolean;
}

export const FleetSchedulePage: FC<FleetSchedulePageProps> = ({ rows, getDocumentTypeLabel, csrfToken, canManage }) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Fleet Schedule</h1>
          <p>Upcoming and overdue service reminders plus expiring registration and insurance documents.</p>
        </div>
        <div class="actions">
          <a class="btn" href="/fleet">← Fleet</a>
          <a class="btn" href="/settings">Reminder Settings</a>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Service & Renewal Schedule</h2>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
            {rows.length} items
          </span>
        </div>
        <div class="table-wrap" style="margin:0 -18px -16px;">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Service</th>
                <th>Due Date / Mileage</th>
                <th>Status</th>
                <th>Expiring Documents</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr>
                  <td>
                    <div><a href={`/fleet/vehicles/${row.vehicle_id}`}><b>{row.vehicle_display_name}</b></a></div>
                    <div class="muted small" style="margin-top:4px;">Current odometer: {row.current_odometer ?? '—'}</div>
                  </td>
                  <td>
                    <div><b>{row.reminder.label}</b></div>
                    <div class="muted small" style="margin-top:4px;">{row.reminder.reason}</div>
                  </td>
                  <td>
                    <div>{row.reminder.dueAtDate || '—'}</div>
                    <div class="muted small" style="margin-top:4px;">Mileage: {row.reminder.dueAtOdometer ?? '—'}</div>
                  </td>
                  <td>
                    <span class={row.reminder.isDue ? 'badge badge-bad' : 'badge badge-good'}>
                      {row.reminder.isDue ? 'Due' : 'Upcoming'}
                    </span>
                    <div class="muted small" style="margin-top:4px;">
                      {row.reminder.daysRemaining !== null ? `${row.reminder.daysRemaining} days` : 'No day threshold'}
                      {row.reminder.milesRemaining !== null ? ` • ${row.reminder.milesRemaining.toLocaleString('en-US')} miles` : ''}
                    </div>
                  </td>
                  <td>
                    {row.expiringDocuments.length > 0 ? row.expiringDocuments.map((document) => (
                      <div style="margin-bottom:6px;">
                        <a href={`/fleet/documents/${document.id}/file`}><b>{document.title}</b></a>
                        <div class="muted small">{getDocumentTypeLabel(document.document_type)} • {document.expiration_date || 'No expiration'}</div>
                      </div>
                    )) : <span class="muted">No expiring docs</span>}

                    {canManage ? (
                      <form method="post" action={`/fleet/vehicles/${row.vehicle_id}/reminders/complete`}
                        style="margin-top:10px; padding:12px; border:1px solid var(--border); border-radius:12px; background:#F8FAFC;">
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <input type="hidden" name="category" value={row.reminder.category} />
                        <input type="hidden" name="return_to" value="/fleet/schedule" />
                        <div style="font-weight:800; margin-bottom:10px;">Mark {row.reminder.label} Complete</div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px;">
                          <div>
                            <label>Date</label>
                            <input type="date" name="entry_date" value={new Date().toISOString().slice(0, 10)} required />
                          </div>
                          <div>
                            <label>Odometer</label>
                            <input type="number" step="1" name="odometer" value={row.current_odometer ?? ''} />
                          </div>
                          <div>
                            <label>Vendor</label>
                            <input name="vendor" maxLength={120} placeholder="Optional vendor" />
                          </div>
                          <div>
                            <label>Amount</label>
                            <input type="number" step="0.01" min="0.01" name="amount" placeholder="0.00" required />
                          </div>
                        </div>
                        <div style="margin-top:10px;">
                          <label>Notes</label>
                          <textarea name="notes" rows={2} placeholder="Completed from schedule view"></textarea>
                        </div>
                        <div style="margin-top:10px; display:flex; justify-content:flex-end;">
                          <button class="btn" type="submit">Save Completion</button>
                        </div>
                      </form>
                    ) : null}
                  </td>
                </tr>
              )) : <tr><td colspan={5} class="muted">No schedule items are available yet. Add maintenance history or upload fleet documents first.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FleetSchedulePage;
