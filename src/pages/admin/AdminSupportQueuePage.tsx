import type { FC } from 'hono/jsx';

interface SupportTicketRow {
  id: number;
  tenant_id: number;
  tenant_name: string;
  tenant_subdomain: string;
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

interface TenantOption {
  id: number;
  name: string;
  subdomain: string;
}

interface AdminSupportQueuePageProps {
  tickets: SupportTicketRow[];
  tenants: TenantOption[];
  csrfToken: string;
  selectedTenantId: string;
  selectedPriority: string;
  selectedStatus: string;
  notice?: {
    tone: 'good' | 'bad';
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

export const AdminSupportQueuePage: FC<AdminSupportQueuePageProps> = ({
  tickets,
  tenants,
  csrfToken,
  selectedTenantId,
  selectedPriority,
  selectedStatus,
  notice,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Support Queue</h1>
          <p class="muted">Cross-tenant support visibility with priority triage and internal notes.</p>
        </div>
      </div>

      {notice ? (
        <div
          class="card"
          style={
            notice.tone === 'good'
              ? 'margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;'
              : 'margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;'
          }
        >
          {notice.message}
        </div>
      ) : null}

      <div class="card" style="margin-bottom:14px;">
        <form method="get" action="/admin/support">
          <div class="row">
            <div>
              <label>Tenant</label>
              <select name="tenant_id">
                <option value="">All tenants</option>
                {tenants.map((tenant) => (
                  <option
                    value={String(tenant.id)}
                    selected={selectedTenantId === String(tenant.id)}
                  >
                    {tenant.name} ({tenant.subdomain})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Priority</label>
              <select name="priority">
                <option value="">All priorities</option>
                <option value="low" selected={selectedPriority === 'low'}>Low</option>
                <option value="normal" selected={selectedPriority === 'normal'}>Normal</option>
                <option value="high" selected={selectedPriority === 'high'}>High</option>
                <option value="critical" selected={selectedPriority === 'critical'}>Critical</option>
              </select>
            </div>

            <div>
              <label>Status</label>
              <select name="status">
                <option value="">All statuses</option>
                <option value="open" selected={selectedStatus === 'open'}>Open</option>
                <option value="in_progress" selected={selectedStatus === 'in_progress'}>In Progress</option>
                <option
                  value="waiting_on_customer"
                  selected={selectedStatus === 'waiting_on_customer'}
                >
                  Waiting on Customer
                </option>
                <option value="closed" selected={selectedStatus === 'closed'}>Closed</option>
              </select>
            </div>

            <div style="flex:0;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" type="submit">Filter</button>
            </div>
          </div>
        </form>
      </div>

      <div class="list">
        {tickets.length ? tickets.map((ticket) => (
          <div class="card">
            <div style="display:flex; justify-content:space-between; gap:14px; align-items:flex-start; flex-wrap:wrap;">
              <div style="min-width:0; flex:1;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <strong>#{ticket.id} — {ticket.subject}</strong>
                  <span class={priorityBadgeClass(ticket.priority)}>{priorityLabel(ticket.priority)}</span>
                  <span class={statusBadgeClass(ticket.status)}>{statusLabel(ticket.status)}</span>
                </div>

                <div class="muted" style="margin-top:6px;">
                  Tenant: {ticket.tenant_name} ({ticket.tenant_subdomain})
                </div>

                <div class="muted" style="margin-top:4px;">
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
                    <div style="font-weight:800; margin-bottom:6px;">Internal Notes</div>
                    <div style="white-space:pre-wrap; line-height:1.6;">{ticket.internal_notes}</div>
                  </div>
                ) : null}
              </div>

              <div style="width:min(360px, 100%);">
                <form method="post" action={`/admin/support/${ticket.id}/update`}>
                  <input type="hidden" name="csrf_token" value={csrfToken} />

                  <label>Priority</label>
                  <select name="priority">
                    <option value="low" selected={ticket.priority === 'low'}>Low</option>
                    <option value="normal" selected={ticket.priority === 'normal'}>Normal</option>
                    <option value="high" selected={ticket.priority === 'high'}>High</option>
                    <option value="critical" selected={ticket.priority === 'critical'}>Critical</option>
                  </select>

                  <label>Status</label>
                  <select name="status">
                    <option value="open" selected={ticket.status === 'open'}>Open</option>
                    <option value="in_progress" selected={ticket.status === 'in_progress'}>In Progress</option>
                    <option
                      value="waiting_on_customer"
                      selected={ticket.status === 'waiting_on_customer'}
                    >
                      Waiting on Customer
                    </option>
                    <option value="closed" selected={ticket.status === 'closed'}>Closed</option>
                  </select>

                  <label>Internal Notes</label>
                  <textarea
                    name="internal_notes"
                    rows={7}
                    maxlength={5000}
                    placeholder="Internal support notes, follow-up details, or customer communication summary."
                  >
                    {ticket.internal_notes || ''}
                  </textarea>

                  <div class="actions" style="margin-top:14px;">
                    <button class="btn btn-primary" type="submit">Save Ticket Update</button>
                    <a class="btn" href={`/admin/tenants/${ticket.tenant_id}`}>Tenant Detail</a>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )) : (
          <div class="card muted">No support tickets found for the current filters.</div>
        )}
      </div>
    </div>
  );
};

export default AdminSupportQueuePage;