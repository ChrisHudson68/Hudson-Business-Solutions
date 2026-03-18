import type { FC } from 'hono/jsx';

interface AdminTenantDetailPageProps {
  tenant: {
    id: number;
    name: string;
    subdomain: string;
    logo_path: string | null;
    invoice_prefix: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_address: string | null;
    default_tax_rate: number | null;
    default_labor_rate: number | null;
    billing_exempt: number;
    billing_status: string;
    billing_plan: string | null;
    billing_trial_ends_at: string | null;
    billing_grace_ends_at: string | null;
    billing_customer_id: string | null;
    billing_subscription_id: string | null;
    billing_subscription_status: string | null;
    billing_updated_at: string | null;
    created_at: string | null;
    user_count: number;
    job_count: number;
    invoice_count: number;
    payment_count: number;
  };
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    active: number;
  }>;
  workspaceLoginUrl: string;
  csrfToken: string;
  notice?: {
    tone: 'good' | 'warn' | 'bad';
    message: string;
  };
}

function badgeClass(status: string, exempt: number): string {
  if (Number(exempt) === 1 || status === 'internal') return 'badge badge-good';
  if (status === 'active') return 'badge badge-good';
  if (status === 'trialing') return 'badge badge-warn';
  if (status === 'past_due') return 'badge badge-bad';
  if (status === 'canceled') return 'badge badge-bad';
  return 'badge';
}

function noticeStyle(tone: 'good' | 'warn' | 'bad'): string {
  if (tone === 'good') {
    return 'margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;';
  }
  if (tone === 'warn') {
    return 'margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;';
  }
  return 'margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;';
}

export const AdminTenantDetailPage: FC<AdminTenantDetailPageProps> = ({
  tenant,
  users,
  workspaceLoginUrl,
  csrfToken,
  notice,
}) => {
  const isExempt = Number(tenant.billing_exempt) === 1;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{tenant.name}</h1>
          <p>Cross-tenant detail view for support, billing, and operational controls.</p>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <a class="btn" href="/admin/tenants">Back to Tenants</a>
          <a class="btn btn-primary" href={workspaceLoginUrl}>Open Workspace</a>
        </div>
      </div>

      {notice ? (
        <div class="card" style={noticeStyle(notice.tone)}>
          {notice.message}
        </div>
      ) : null}

      <div class="grid grid-4">
        <div class="card">
          <div class="stat-label">Users</div>
          <div class="stat-value">{tenant.user_count}</div>
        </div>
        <div class="card">
          <div class="stat-label">Jobs</div>
          <div class="stat-value">{tenant.job_count}</div>
        </div>
        <div class="card">
          <div class="stat-label">Invoices</div>
          <div class="stat-value">{tenant.invoice_count}</div>
        </div>
        <div class="card">
          <div class="stat-label">Payments</div>
          <div class="stat-value">{tenant.payment_count}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Tenant Details</div>
          <div class="list">
            <div class="list-item"><strong>Subdomain:</strong> {tenant.subdomain}</div>
            <div class="list-item"><strong>Company Email:</strong> {tenant.company_email || '—'}</div>
            <div class="list-item"><strong>Company Phone:</strong> {tenant.company_phone || '—'}</div>
            <div class="list-item"><strong>Company Address:</strong> {tenant.company_address || '—'}</div>
            <div class="list-item"><strong>Invoice Prefix:</strong> {tenant.invoice_prefix || '—'}</div>
            <div class="list-item"><strong>Created:</strong> {tenant.created_at || '—'}</div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Billing Details</div>
          <div class="list">
            <div class="list-item">
              <strong>Status:</strong>{' '}
              <span class={badgeClass(tenant.billing_status, tenant.billing_exempt)}>
                {tenant.billing_exempt ? 'internal' : tenant.billing_status}
              </span>
            </div>
            <div class="list-item"><strong>Billing Exempt:</strong> {tenant.billing_exempt ? 'Yes' : 'No'}</div>
            <div class="list-item"><strong>Plan:</strong> {tenant.billing_plan || '—'}</div>
            <div class="list-item"><strong>Trial Ends:</strong> {tenant.billing_trial_ends_at || '—'}</div>
            <div class="list-item"><strong>Grace Ends:</strong> {tenant.billing_grace_ends_at || '—'}</div>
            <div class="list-item"><strong>Stripe Customer ID:</strong> {tenant.billing_customer_id || '—'}</div>
            <div class="list-item"><strong>Stripe Subscription ID:</strong> {tenant.billing_subscription_id || '—'}</div>
            <div class="list-item"><strong>Subscription Status:</strong> {tenant.billing_subscription_status || '—'}</div>
            <div class="list-item"><strong>Billing Updated:</strong> {tenant.billing_updated_at || '—'}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Billing Controls</div>

          <div style="display:grid; gap:12px;">
            <div class="muted" style="line-height:1.6;">
              These are platform-owner controls for operational support. They write directly to the tenant billing record in your app database.
            </div>

            <div style="display:grid; gap:10px;">
              <form method="post" action={`/admin/tenants/${tenant.id}/billing/toggle-exempt`} style="margin:0;">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button class="btn" type="submit">
                  {isExempt ? 'Remove Internal / Exempt' : 'Mark Internal / Exempt'}
                </button>
              </form>

              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <form method="post" action={`/admin/tenants/${tenant.id}/billing/set-status`} style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <input type="hidden" name="status" value="trialing" />
                  <button class="btn" type="submit">Set Trialing</button>
                </form>

                <form method="post" action={`/admin/tenants/${tenant.id}/billing/set-status`} style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <input type="hidden" name="status" value="active" />
                  <button class="btn" type="submit">Set Active</button>
                </form>

                <form method="post" action={`/admin/tenants/${tenant.id}/billing/set-status`} style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <input type="hidden" name="status" value="past_due" />
                  <button class="btn" type="submit">Set Past Due</button>
                </form>

                <form method="post" action={`/admin/tenants/${tenant.id}/billing/set-status`} style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <input type="hidden" name="status" value="canceled" />
                  <button class="btn" type="submit">Set Canceled</button>
                </form>
              </div>

              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <form method="post" action={`/admin/tenants/${tenant.id}/billing/extend-trial`} style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn" type="submit">Extend Trial +14 Days</button>
                </form>

                <form method="post" action={`/admin/tenants/${tenant.id}/billing/extend-grace`} style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn" type="submit">Extend Grace +7 Days</button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Default Rates</div>
          <div class="list">
            <div class="list-item"><strong>Default Tax Rate:</strong> {tenant.default_tax_rate ?? '—'}</div>
            <div class="list-item"><strong>Default Labor Rate:</strong> {tenant.default_labor_rate ?? '—'}</div>
          </div>

          <div style="font-weight:900; font-size:18px; margin:20px 0 12px;">Support Guidance</div>
          <div class="muted" style="line-height:1.7;">
            Use internal / exempt for your own workspaces and non-billed support tenants. Use trial and grace extensions sparingly and only when you are intentionally overriding normal Stripe-driven behavior.
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:12px;">
          <div>
            <div style="font-weight:900; font-size:18px;">Tenant Users</div>
            <div class="muted" style="margin-top:6px; line-height:1.6;">
              Start impersonation from here. This creates a temporary support session inside the tenant workspace without exposing passwords.
            </div>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((user) => (
                <tr>
                  <td>
                    <div style="font-weight:900;">{user.name}</div>
                    <div class="muted" style="margin-top:4px;">{user.email}</div>
                  </td>
                  <td>{user.role}</td>
                  <td>
                    <span class={user.active === 1 ? 'badge badge-good' : 'badge badge-bad'}>
                      {user.active === 1 ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    {user.active === 1 ? (
                      <form method="post" action={`/admin/tenants/${tenant.id}/impersonate`} style="margin:0; display:inline;">
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <input type="hidden" name="user_id" value={user.id} />
                        <button class="btn" type="submit">Impersonate</button>
                      </form>
                    ) : (
                      <span class="muted">Unavailable</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} class="muted">No tenant users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminTenantDetailPage;
