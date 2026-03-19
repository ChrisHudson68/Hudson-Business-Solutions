import type { FC } from 'hono/jsx';

interface SupportTicket {
  id: number;
  subject: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
}

interface SupportPageProps {
  tickets: SupportTicket[];
  notice?: { tone: 'good' | 'warn' | 'bad'; message: string };
  csrfToken: string;
}

function priorityBadgeClass(priority: SupportTicket['priority']): string {
  if (priority === 'critical') return 'badge badge-bad';
  if (priority === 'high') return 'badge badge-warn';
  if (priority === 'normal') return 'badge badge-good';
  return 'badge';
}

function statusBadgeClass(status: SupportTicket['status']): string {
  if (status === 'closed') return 'badge badge-good';
  if (status === 'in_progress') return 'badge badge-warn';
  return 'badge';
}

export const SupportPage: FC<SupportPageProps> = ({
  tickets,
  notice,
  csrfToken,
}) => {
  const openTickets = tickets.filter((t) => t.status !== 'closed').length;
  const criticalTickets = tickets.filter((t) => t.priority === 'critical' && t.status !== 'closed').length;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Support Center</h1>
          <p>Get help with billing, technical issues, or questions about using Hudson Business Solutions.</p>
        </div>
      </div>

      {notice && (
        <div class={`notice notice-${notice.tone}`} style="margin-bottom:16px;">
          {notice.message}
        </div>
      )}

      <div class="grid grid-3">
        <div class="card">
          <div class="stat-label">Open Tickets</div>
          <div class="stat-value">{openTickets}</div>
        </div>

        <div class="card">
          <div class="stat-label">Critical Issues</div>
          <div class="stat-value">{criticalTickets}</div>
        </div>

        <div class="card">
          <div class="stat-label">Total Tickets</div>
          <div class="stat-value">{tickets.length}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">How Support Works</div>

          <div class="list">
            <div class="list-item">
              Submit a ticket describing your issue or request.
            </div>
            <div class="list-item">
              Critical issues affecting your ability to operate will be prioritized.
            </div>
            <div class="list-item">
              Billing issues are typically resolved the same business day.
            </div>
            <div class="list-item">
              You will receive updates as work progresses.
            </div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Before Submitting</div>

          <div class="list">
            <div class="list-item">
              Include job names, employee names, or invoice numbers if relevant.
            </div>
            <div class="list-item">
              Describe what you expected to happen versus what occurred.
            </div>
            <div class="list-item">
              Note whether the issue is blocking normal operations.
            </div>
            <div class="list-item">
              Billing questions can often be resolved from the Billing page.
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="font-weight:900; font-size:18px; margin-bottom:12px;">
          Submit a Support Request
        </div>

        <form method="POST" action="/support/create" class="form">
          <input type="hidden" name="csrfToken" value={csrfToken} />

          <div class="form-group">
            <label>Subject</label>
            <input name="subject" required />
          </div>

          <div class="form-group">
            <label>Priority</label>
            <select name="priority" required>
              <option value="low">Low — General question</option>
              <option value="normal">Normal — Minor issue</option>
              <option value="high">High — Significant problem</option>
              <option value="critical">Critical — Operations blocked</option>
            </select>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows={5} required />
          </div>

          <button class="btn btn-primary">Submit Ticket</button>
        </form>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="font-weight:900; font-size:18px; margin-bottom:12px;">
          Your Support Tickets
        </div>

        {tickets.length === 0 ? (
          <div class="muted">
            You have not submitted any support requests yet. If you need assistance,
            create a ticket above and our team will respond.
          </div>
        ) : (
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr>
                    <td>{t.subject}</td>
                    <td>
                      <span class={priorityBadgeClass(t.priority)}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      <span class={statusBadgeClass(t.status)}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.created_at}</td>
                    <td>{t.updated_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportPage;