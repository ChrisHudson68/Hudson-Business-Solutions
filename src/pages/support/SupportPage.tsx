import type { FC } from 'hono/jsx';

interface SupportTicketRow {
  id: number;
  subject: string;
  message: string;
  priority: string;
  status: string;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  created_by_email: string | null;
}

interface SupportPageProps {
  tickets: SupportTicketRow[];
  csrfToken: string;
  error?: string;
  success?: string;
  formData?: {
    subject: string;
    priority: string;
    message: string;
  };
}

function priorityBadgeClass(priority: string): string {
  const normalized = String(priority || '').toLowerCase();

  if (normalized === 'critical') return 'badge badge-bad';
  if (normalized === 'high') return 'badge badge-warn';
  if (normalized === 'low') return 'badge badge-good';
  return 'badge';
}

function priorityLabel(priority: string): string {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'high') return 'High';
  if (normalized === 'low') return 'Low';
  return 'Normal';
}

function statusBadgeClass(status: string): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'closed') return 'badge badge-good';
  if (normalized === 'waiting_on_customer') return 'badge badge-warn';
  if (normalized === 'in_progress') return 'badge badge-warn';
  return 'badge';
}

function statusLabel(status: string): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'in_progress') return 'In Progress';
  if (normalized === 'waiting_on_customer') return 'Waiting on Customer';
  if (normalized === 'closed') return 'Closed';
  return 'Open';
}

export const SupportPage: FC<SupportPageProps> = ({
  tickets,
  csrfToken,
  error,
  success,
  formData,
}) => {
  const values = {
    subject: String(formData?.subject || ''),
    priority: String(formData?.priority || 'normal'),
    message: String(formData?.message || ''),
  };

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Support</h1>
          <p>Submit support requests for your workspace and track their status.</p>
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

      <div class="grid grid-2">
        <div class="card">
          <h3 style="margin-top:0;">Submit a Support Request</h3>
          <p class="muted" style="margin-top:0;">
            Use priority levels to help us triage requests appropriately.
          </p>

          <form method="post" action="/support">
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <label>Subject</label>
            <input
              name="subject"
              value={values.subject}
              maxlength={140}
              required
              placeholder="Example: Unable to reconcile invoice payment"
            />

            <label>Priority</label>
            <select name="priority">
              <option value="low" selected={values.priority === 'low'}>Low</option>
              <option value="normal" selected={values.priority === 'normal'}>Normal</option>
              <option value="high" selected={values.priority === 'high'}>High</option>
              <option value="critical" selected={values.priority === 'critical'}>Critical</option>
            </select>

            <label>Message</label>
            <textarea
              name="message"
              rows={8}
              maxlength={5000}
              required
              placeholder="Describe the issue, what you expected, and any relevant job, invoice, employee, or billing details."
            >
              {values.message}
            </textarea>

            <div class="actions" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit">Submit Ticket</button>
            </div>
          </form>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Priority Guidelines</h3>

          <div class="list">
            <div class="list-item">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="badge badge-good">Low</span>
                <strong>Minor questions or polish issues</strong>
              </div>
              <div class="muted" style="margin-top:6px;">
                General how-to questions, non-blocking UI feedback, or small issues.
              </div>
            </div>

            <div class="list-item">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="badge">Normal</span>
                <strong>Standard support request</strong>
              </div>
              <div class="muted" style="margin-top:6px;">
                Most requests should use this level by default.
              </div>
            </div>

            <div class="list-item">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="badge badge-warn">High</span>
                <strong>Operational issue affecting daily work</strong>
              </div>
              <div class="muted" style="margin-top:6px;">
                Important workflows are blocked or producing incorrect results.
              </div>
            </div>

            <div class="list-item">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span class="badge badge-bad">Critical</span>
                <strong>Billing, access, or major production issue</strong>
              </div>
              <div class="muted" style="margin-top:6px;">
                Use only when the workspace is severely impacted or normal operations cannot continue.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
          <div>
            <h3 style="margin:0;">Ticket History</h3>
            <div class="muted" style="margin-top:4px;">
              Visibility across your tenant workspace for submitted support requests.
            </div>
          </div>
          <span class="badge">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</span>
        </div>

        <div class="list">
          {tickets.length ? tickets.map((ticket) => (
            <div class="list-item">
              <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                <div style="min-width:0; flex:1;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <strong>#{ticket.id} — {ticket.subject}</strong>
                    <span class={priorityBadgeClass(ticket.priority)}>{priorityLabel(ticket.priority)}</span>
                    <span class={statusBadgeClass(ticket.status)}>{statusLabel(ticket.status)}</span>
                  </div>

                  <div class="muted" style="margin-top:6px;">
                    Submitted by {ticket.created_by_name || 'Unknown user'}
                    {ticket.created_by_email ? ` (${ticket.created_by_email})` : ''}
                  </div>

                  <div class="muted" style="margin-top:4px;">
                    Created: {ticket.created_at} • Updated: {ticket.updated_at}
                  </div>

                  <div style="margin-top:12px; white-space:pre-wrap; line-height:1.6;">
                    {ticket.message}
                  </div>

                  {ticket.internal_notes ? (
                    <div
                      style="margin-top:12px; padding:12px; border-radius:12px; background:#F8FAFC; border:1px solid #E5EAF2;"
                    >
                      <div style="font-weight:800; margin-bottom:6px;">Support Notes</div>
                      <div style="white-space:pre-wrap; line-height:1.6;">{ticket.internal_notes}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )) : (
            <div class="muted">No support tickets have been submitted yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportPage;