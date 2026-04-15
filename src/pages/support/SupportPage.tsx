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

interface SupportNotice {
  tone: 'good' | 'warn' | 'bad';
  message: string;
}

interface SupportPageProps {
  tickets: SupportTicketRow[];
  csrfToken: string;
  notice?: SupportNotice;
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

function noticeClass(tone: SupportNotice['tone']): string {
  if (tone === 'good') return 'notice notice-good';
  if (tone === 'warn') return 'notice notice-warn';
  return 'notice notice-bad';
}

export const SupportPage: FC<SupportPageProps> = ({
  tickets,
  csrfToken,
  notice,
  formData,
}) => {
  const values = {
    subject: String(formData?.subject || ''),
    priority: String(formData?.priority || 'normal'),
    message: String(formData?.message || ''),
  };

  const openTickets = tickets.filter((ticket) => String(ticket.status).toLowerCase() === 'open').length;
  const inProgressTickets = tickets.filter((ticket) => String(ticket.status).toLowerCase() === 'in_progress').length;
  const waitingOnCustomerTickets = tickets.filter((ticket) => String(ticket.status).toLowerCase() === 'waiting_on_customer').length;
  const closedTickets = tickets.filter((ticket) => String(ticket.status).toLowerCase() === 'closed').length;
  const criticalOpenTickets = tickets.filter((ticket) => {
    const priority = String(ticket.priority).toLowerCase();
    const status = String(ticket.status).toLowerCase();
    return priority === 'critical' && status !== 'closed';
  }).length;

  const hasActiveTickets = openTickets > 0 || inProgressTickets > 0 || waitingOnCustomerTickets > 0;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Support Center</h1>
          <p>Get help with billing, technical issues, account access, and day-to-day workflow questions.</p>
        </div>
      </div>

      {notice ? (
        <div class={noticeClass(notice.tone)} style="margin-bottom:14px;">
          {notice.message}
        </div>
      ) : null}

      <div class="stat-grid stat-grid-4" style="margin-bottom:16px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Open</div>
          <div class="stat-value">{openTickets}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">In Progress</div>
          <div class="stat-value">{inProgressTickets}</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Waiting on You</div>
          <div class="stat-value">{waitingOnCustomerTickets}</div>
        </div>
        <div class="stat-card stat-card-red">
          <div class="stat-label">Critical Open</div>
          <div class="stat-value">{criticalOpenTickets}</div>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:14px;">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">How Support Works</div>

          <div class="list">
            <div class="list-item">
              Submit one ticket per issue so updates stay clear and organized.
            </div>
            <div class="list-item">
              Include job names, invoice numbers, employee names, or exact page names when relevant.
            </div>
            <div class="list-item">
              Critical and high-priority requests are reviewed first.
            </div>
            <div class="list-item">
              If we need more details, your ticket may move to <strong>Waiting on Customer</strong>.
            </div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Priority Guidance</div>

          <div class="list">
            <div class="list-item">
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span class="badge badge-good">Low</span>
                <strong>General questions or minor polish issues</strong>
              </div>
            </div>

            <div class="list-item">
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span class="badge">Normal</span>
                <strong>Standard support requests</strong>
              </div>
            </div>

            <div class="list-item">
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span class="badge badge-warn">High</span>
                <strong>Important issue affecting daily operations</strong>
              </div>
            </div>

            <div class="list-item">
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span class="badge badge-bad">Critical</span>
                <strong>Billing, access, or production-blocking issue</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Recommended Next Step</div>

          {!hasActiveTickets ? (
            <div class="muted">
              You do not have any active support requests right now. Use the form below any time you need help.
            </div>
          ) : waitingOnCustomerTickets > 0 ? (
            <div class="muted">
              You have ticket updates waiting on your response. Review your ticket history below and submit any requested details as a new follow-up ticket if needed.
            </div>
          ) : criticalOpenTickets > 0 ? (
            <div class="muted">
              You currently have a critical issue open. Avoid opening duplicate tickets for the same problem unless the scope has changed.
            </div>
          ) : (
            <div class="muted">
              You have active support work in progress. Keep new tickets focused on separate issues so tracking stays clear.
            </div>
          )}

          <div style="margin-top:12px;" class="muted">
            Closed tickets: {closedTickets}
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Submit a Support Request</div>
          <div class="muted" style="margin-bottom:12px;">
            Describe what happened, what you expected, and whether normal operations are blocked.
          </div>

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
              <option value="low" selected={values.priority === 'low'}>Low — General question</option>
              <option value="normal" selected={values.priority === 'normal'}>Normal — Standard request</option>
              <option value="high" selected={values.priority === 'high'}>High — Important workflow issue</option>
              <option value="critical" selected={values.priority === 'critical'}>Critical — Operations blocked</option>
            </select>

            <label>Message</label>
            <textarea
              name="message"
              rows={8}
              maxlength={5000}
              required
              placeholder="Describe the issue, what you expected, what actually happened, and any relevant job, invoice, employee, billing, or access details."
            >
              {values.message}
            </textarea>

            <div class="actions" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit">Submit Ticket</button>
            </div>
          </form>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Helpful Tips</div>

          <div class="list">
            <div class="list-item">
              For billing questions, review your Billing page first for subscription and payment status.
            </div>
            <div class="list-item">
              For access issues, note which user cannot sign in and what happens after they enter credentials.
            </div>
            <div class="list-item">
              For invoice or job issues, include the exact record name or number.
            </div>
            <div class="list-item">
              For reporting questions, include the report name and the date range you expected to see.
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:12px;">
          <div>
            <h3 style="margin:0;">Ticket History</h3>
            <div class="muted" style="margin-top:4px;">
              Track current and past support requests for this workspace.
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
                    Created: {ticket.created_at} · Updated: {ticket.updated_at}
                  </div>

                  <div style="margin-top:12px; white-space:pre-wrap; line-height:1.6;">
                    {ticket.message}
                  </div>

                  {ticket.internal_notes ? (
                    <div
                      style="margin-top:12px; padding:12px; border-radius:12px; background:#F8FAFC; border:1px solid #E5EAF2;"
                    >
                      <div style="font-weight:800; margin-bottom:6px;">Latest Support Update</div>
                      <div style="white-space:pre-wrap; line-height:1.6;">{ticket.internal_notes}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )) : (
            <div class="muted">
              No support tickets have been submitted yet. When you need help, submit a request above and it will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportPage;