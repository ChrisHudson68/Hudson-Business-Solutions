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
    billing_state?: string | null;
    billing_grace_until?: string | null;
    billing_override_reason?: string | null;
    billing_overridden_by_user_id?: number | null;
    billing_overridden_at?: string | null;
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
    can_impersonate: boolean;
  }>;
  workspaceLoginUrl: string;
  csrfToken: string;
  userSearch: string;
  roleFilter: string;
  statusFilter: string;
  notice?: {
    tone: 'good' | 'warn' | 'bad';
    message: string;
  };
}

function legacyBadgeClass(status: string, exempt: number): string {
  if (Number(exempt) === 1 || status === 'internal') return 'badge badge-good';
  if (status === 'active') return 'badge badge-good';
  if (status === 'trialing') return 'badge badge-warn';
  if (status === 'past_due') return 'badge badge-bad';
  if (status === 'canceled') return 'badge badge-bad';
  return 'badge';
}

function billingStateBadgeClass(state: string): string {
  const value = String(state || '').trim().toLowerCase();

  if (value === 'internal' || value === 'billing_exempt' || value === 'active') {
    return 'badge badge-good';
  }
  if (value === 'trialing' || value === 'grace_period') {
    return 'badge badge-warn';
  }
  if (value === 'past_due' || value === 'suspended' || value === 'canceled') {
    return 'badge badge-bad';
  }
  return 'badge';
}

function noticeStyle(tone: 'good' | 'warn' | 'bad'): string {
  if (tone === 'good') return 'margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;';
  if (tone === 'warn') return 'margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;';
  return 'margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;';
}

function userRoleBadge(role: string): string {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin') return 'badge';
  if (value === 'manager') return 'badge badge-good';
  return 'badge badge-warn';
}

function supportStatusLabel(user: { active: number; can_impersonate: boolean; role: string }): {
  label: string;
  className: string;
} {
  if (user.active !== 1) return { label: 'Disabled', className: 'badge badge-bad' };
  if (!user.can_impersonate && String(user.role).trim().toLowerCase() === 'admin') {
    return { label: 'Admin Blocked', className: 'badge badge-bad' };
  }
  if (!user.can_impersonate) return { label: 'Unavailable', className: 'badge' };
  return { label: 'Eligible', className: 'badge badge-good' };
}

function formatDateForInput(value?: string | null): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export const AdminTenantDetailPage: FC<AdminTenantDetailPageProps> = ({
  tenant,
  users,
  workspaceLoginUrl,
  csrfToken,
  userSearch,
  roleFilter,
  statusFilter,
  notice,
}) => {
  const isExempt = Number(tenant.billing_exempt) === 1;
  const eligibleUsers = users.filter((user) => user.can_impersonate).length;
  const blockedUsers = users.filter((user) => !user.can_impersonate).length;

  const effectiveLegacyStatus = tenant.billing_exempt ? 'internal' : tenant.billing_status;
  const effectiveBillingState = String(tenant.billing_state || '').trim() || '—';
  const billingMismatch =
    effectiveBillingState !== '—' &&
    String(effectiveLegacyStatus).trim().toLowerCase() !== effectiveBillingState.trim().toLowerCase();

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{tenant.name}</h1>
          <p>Cross-tenant detail view for support, billing, and operational controls.</p>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <a class="btn" href="/admin/tenants">Back to Tenants</a>
          <a class="btn" href={`/admin/activity?tenant_id=${tenant.id}`}>Tenant Activity</a>
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
              <strong>Legacy Billing Status:</strong>{' '}
              <span class={legacyBadgeClass(tenant.billing_status, tenant.billing_exempt)}>
                {effectiveLegacyStatus}
              </span>
            </div>

            <div class="list-item">
              <strong>Advanced Billing State:</strong>{' '}
              <span class={billingStateBadgeClass(effectiveBillingState)}>
                {effectiveBillingState}
              </span>
            </div>

            {billingMismatch ? (
              <div class="list-item" style="color:#92400E;">
                <strong>State Mismatch:</strong> Legacy status and advanced billing state currently differ.
              </div>
            ) : null}

            <div class="list-item"><strong>Billing Exempt:</strong> {tenant.billing_exempt ? 'Yes' : 'No'}</div>
            <div class="list-item"><strong>Plan:</strong> {tenant.billing_plan || '—'}</div>
            <div class="list-item"><strong>Trial Ends:</strong> {tenant.billing_trial_ends_at || '—'}</div>
            <div class="list-item"><strong>Legacy Grace Ends:</strong> {tenant.billing_grace_ends_at || '—'}</div>
            <div class="list-item"><strong>Advanced Grace Until:</strong> {tenant.billing_grace_until || '—'}</div>
            <div class="list-item"><strong>Override Reason:</strong> {tenant.billing_override_reason || '—'}</div>
            <div class="list-item"><strong>Overridden At:</strong> {tenant.billing_overridden_at || '—'}</div>
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
              These are platform-owner controls for operational support. Legacy billing actions update the original app billing model. Advanced billing state is the new operator-facing override layer for future enforcement.
            </div>

            <div style="display:grid; gap:10px;">
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <form method="post" action={`/admin/tenants/${tenant.id}/billing/resync`} style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn btn-primary" type="submit">Refresh from Stripe</button>
                </form>

                <form method="post" action={`/admin/tenants/${tenant.id}/billing/toggle-exempt`} style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn" type="submit">
                    {isExempt ? 'Remove Internal / Exempt' : 'Mark Internal / Exempt'}
                  </button>
                </form>
              </div>

              <div class="muted" style="line-height:1.6;">
                Refresh from Stripe is the owner-side recovery action for missed webhooks or stale tenant billing records. It does not create a subscription, but it will pull the latest Stripe customer and subscription status into the workspace.
              </div>

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
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Advanced Billing State Control</div>

          <form method="post" action={`/admin/tenants/${tenant.id}/billing/override`} style="display:grid; gap:12px;">
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <div>
              <label style="display:block; font-weight:800; margin-bottom:6px;">Billing State</label>
              <select
                name="billing_state"
                style="width:100%; min-height:40px; padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:#fff;"
              >
                <option value="trialing" selected={effectiveBillingState === 'trialing'}>Trialing</option>
                <option value="active" selected={effectiveBillingState === 'active'}>Active</option>
                <option value="past_due" selected={effectiveBillingState === 'past_due'}>Past Due</option>
                <option value="grace_period" selected={effectiveBillingState === 'grace_period'}>Grace Period</option>
                <option value="suspended" selected={effectiveBillingState === 'suspended'}>Suspended</option>
                <option value="canceled" selected={effectiveBillingState === 'canceled'}>Canceled</option>
                <option value="internal" selected={effectiveBillingState === 'internal'}>Internal</option>
                <option value="billing_exempt" selected={effectiveBillingState === 'billing_exempt'}>Billing Exempt</option>
              </select>
            </div>

            <div>
              <label style="display:block; font-weight:800; margin-bottom:6px;">Grace Until (optional)</label>
              <input
                type="date"
                name="grace_until"
                value={formatDateForInput(tenant.billing_grace_until)}
                style="width:100%; min-height:40px; padding:10px 12px; border:1px solid var(--border); border-radius:12px;"
              />
            </div>

            <div>
              <label style="display:block; font-weight:800; margin-bottom:6px;">Override Reason (optional)</label>
              <textarea
                name="reason"
                maxlength={300}
                style="width:100%; min-height:90px; padding:10px 12px; border:1px solid var(--border); border-radius:12px;"
              >
                {tenant.billing_override_reason || ''}
              </textarea>
            </div>

            <button class="btn btn-primary" type="submit">Apply Billing Override</button>
          </form>

          <div class="muted" style="margin-top:12px; line-height:1.6;">
            This does not contact Stripe. It stores an operator-side billing state that Phase 5B can use for warnings, grace logic, and suspension enforcement.
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Support Summary</div>
        <div class="list">
          <div class="list-item"><strong>Eligible Users:</strong> {eligibleUsers}</div>
          <div class="list-item"><strong>Blocked / Unavailable:</strong> {blockedUsers}</div>
          <div class="list-item"><strong>Default Tax Rate:</strong> {tenant.default_tax_rate ?? '—'}</div>
          <div class="list-item"><strong>Default Labor Rate:</strong> {tenant.default_labor_rate ?? '—'}</div>
        </div>

        <div style="font-weight:900; font-size:18px; margin:20px 0 12px;">Support Guidance</div>
        <div class="muted" style="line-height:1.7;">
          Phase 3B adds search, quick support selection, and optional reason logging. Tenant Admin users remain blocked for safety in this phase.
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:12px;">
          <div>
            <div style="font-weight:900; font-size:18px;">Tenant Users</div>
            <div class="muted" style="margin-top:6px; line-height:1.6;">
              Search and filter users before starting a support session. Optional reason text is recorded in the audit trail.
            </div>
          </div>
        </div>

        <form method="get" action={`/admin/tenants/${tenant.id}`} style="display:grid; gap:12px; margin-bottom:14px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:end;">
            <div style="flex:2 1 280px; min-width:220px;">
              <label style="display:block; font-weight:800; margin-bottom:6px;">Search users</label>
              <input
                type="text"
                name="q"
                value={userSearch}
                placeholder="Name or email"
                style="width:100%; min-height:40px; padding:10px 12px; border:1px solid var(--border); border-radius:12px;"
              />
            </div>

            <div style="flex:1 1 180px; min-width:160px;">
              <label style="display:block; font-weight:800; margin-bottom:6px;">Role</label>
              <select
                name="role"
                style="width:100%; min-height:40px; padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:#fff;"
              >
                <option value="" selected={!roleFilter}>All Roles</option>
                <option value="Admin" selected={roleFilter === 'Admin'}>Admin</option>
                <option value="Manager" selected={roleFilter === 'Manager'}>Manager</option>
                <option value="Employee" selected={roleFilter === 'Employee'}>Employee</option>
              </select>
            </div>

            <div style="flex:1 1 180px; min-width:160px;">
              <label style="display:block; font-weight:800; margin-bottom:6px;">Status</label>
              <select
                name="status"
                style="width:100%; min-height:40px; padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:#fff;"
              >
                <option value="" selected={!statusFilter}>All Statuses</option>
                <option value="eligible" selected={statusFilter === 'eligible'}>Eligible</option>
                <option value="blocked" selected={statusFilter === 'blocked'}>Blocked</option>
                <option value="disabled" selected={statusFilter === 'disabled'}>Disabled</option>
              </select>
            </div>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" type="submit">Apply</button>
              {(userSearch || roleFilter || statusFilter) ? (
                <a class="btn" href={`/admin/tenants/${tenant.id}`}>Clear</a>
              ) : null}
            </div>
          </div>
        </form>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Login Status</th>
                <th>Support Access</th>
                <th style="min-width:340px;">Support Session</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((user) => {
                const supportStatus = supportStatusLabel(user);

                return (
                  <tr>
                    <td>
                      <div style="font-weight:900;">{user.name}</div>
                      <div class="muted" style="margin-top:4px;">{user.email}</div>
                    </td>
                    <td><span class={userRoleBadge(user.role)}>{user.role}</span></td>
                    <td>
                      <span class={user.active === 1 ? 'badge badge-good' : 'badge badge-bad'}>
                        {user.active === 1 ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td><span class={supportStatus.className}>{supportStatus.label}</span></td>
                    <td>
                      {user.can_impersonate ? (
                        <form
                          method="post"
                          action={`/admin/tenants/${tenant.id}/impersonate`}
                          style="margin:0; display:flex; gap:8px; align-items:center; flex-wrap:wrap;"
                        >
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <input type="hidden" name="user_id" value={user.id} />
                          <input
                            type="text"
                            name="support_reason"
                            placeholder="Optional reason"
                            maxlength={200}
                            style="flex:1 1 220px; min-height:38px; padding:8px 10px; border:1px solid var(--border); border-radius:12px;"
                          />
                          <button class="btn" type="submit">Impersonate</button>
                        </form>
                      ) : (
                        <span class="muted">
                          {user.active !== 1 ? 'User is inactive.' : 'Tenant Admin impersonation stays blocked in Phase 3B.'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} class="muted">No tenant users found for the current filters.</td>
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