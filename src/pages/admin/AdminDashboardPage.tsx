import type { FC } from 'hono/jsx';

interface RecentTenant {
  id: number;
  name: string;
  subdomain: string;
  created_at: string | null;
  billing_status: string;
  billing_exempt: number;
}

interface TenantHealthRow {
  id: number;
  name: string;
  subdomain: string;
  created_at: string | null;
  billing_status: string;
  billing_state: string | null;
  billing_exempt: number;
  onboarding_completed_steps: number;
  onboarding_total_steps: number;
  onboarding_status: 'complete' | 'in_progress' | 'not_started';
  user_count: number;
  active_user_count: number;
  job_count: number;
  employee_count: number;
  invoice_count: number;
  open_support_count: number;
  critical_support_count: number;
  recent_activity_count_7d: number;
  recent_activity_count_30d: number;
  last_activity_at: string | null;
  risk_level: 'good' | 'warn' | 'bad';
  risk_summary: string;
}

interface AdminDashboardPageProps {
  metrics: {
    totalTenants: number;
    activeTenants: number;
    trialingTenants: number;
    internalTenants: number;
    pastDueTenants: number;
    canceledTenants: number;
    onboardingCompleteTenants: number;
    onboardingInProgressTenants: number;
    onboardingNotStartedTenants: number;
    atRiskTenants: number;
    dormantTenants: number;
    openSupportTickets: number;
    criticalSupportTickets: number;
    tenantsWithNoActivity7d: number;
  };
  tenantHealth: TenantHealthRow[];
  recentTenants: RecentTenant[];
}

function badgeClass(status: string, exempt: number): string {
  if (Number(exempt) === 1 || status === 'internal') return 'badge badge-good';
  if (status === 'active') return 'badge badge-good';
  if (status === 'trialing') return 'badge badge-warn';
  if (status === 'past_due') return 'badge badge-bad';
  if (status === 'canceled') return 'badge badge-bad';
  return 'badge';
}

function billingStateBadgeClass(state: string | null | undefined): string {
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

function onboardingBadgeClass(status: TenantHealthRow['onboarding_status']): string {
  if (status === 'complete') return 'badge badge-good';
  if (status === 'in_progress') return 'badge badge-warn';
  return 'badge';
}

function onboardingLabel(status: TenantHealthRow['onboarding_status']): string {
  if (status === 'complete') return 'Complete';
  if (status === 'in_progress') return 'In Progress';
  return 'Not Started';
}

function riskBadgeClass(level: TenantHealthRow['risk_level']): string {
  if (level === 'good') return 'badge badge-good';
  if (level === 'warn') return 'badge badge-warn';
  return 'badge badge-bad';
}

function riskLabel(level: TenantHealthRow['risk_level']): string {
  if (level === 'good') return 'Stable';
  if (level === 'warn') return 'Watch';
  return 'At Risk';
}

export const AdminDashboardPage: FC<AdminDashboardPageProps> = ({
  metrics,
  tenantHealth,
  recentTenants,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Tenant Health Dashboard</h1>
          <p>Owner-level visibility into onboarding progress, billing exposure, support load, and activity risk signals.</p>
        </div>
        <div class="actions">
          <a class="btn" href="/admin/support">Open support queue</a>
          <a class="btn btn-primary" href="/admin/tenants">Open tenant directory</a>
        </div>
      </div>

      <div class="grid grid-4">
        <div class="card">
          <div class="stat-label">Total Tenants</div>
          <div class="stat-value">{metrics.totalTenants}</div>
          <div class="muted" style="margin-top:8px;">{metrics.activeTenants} active · {metrics.trialingTenants} trialing</div>
        </div>

        <div class="card">
          <div class="stat-label">Onboarding Complete</div>
          <div class="stat-value">{metrics.onboardingCompleteTenants}</div>
          <div class="muted" style="margin-top:8px;">{metrics.onboardingInProgressTenants} in progress · {metrics.onboardingNotStartedTenants} not started</div>
        </div>

        <div class="card">
          <div class="stat-label">At-Risk Tenants</div>
          <div class="stat-value">{metrics.atRiskTenants}</div>
          <div class="muted" style="margin-top:8px;">{metrics.dormantTenants} dormant by recent activity</div>
        </div>

        <div class="card">
          <div class="stat-label">Open Support Tickets</div>
          <div class="stat-value">{metrics.openSupportTickets}</div>
          <div class="muted" style="margin-top:8px;">{metrics.criticalSupportTickets} critical · {metrics.tenantsWithNoActivity7d} with no activity in 7 days</div>
        </div>
      </div>

      <div class="grid grid-4" style="margin-top:14px;">
        <div class="card">
          <div class="stat-label">Billing — Active</div>
          <div class="stat-value">{metrics.activeTenants}</div>
        </div>
        <div class="card">
          <div class="stat-label">Billing — Trialing</div>
          <div class="stat-value">{metrics.trialingTenants}</div>
        </div>
        <div class="card">
          <div class="stat-label">Billing — Past Due</div>
          <div class="stat-value">{metrics.pastDueTenants}</div>
        </div>
        <div class="card">
          <div class="stat-label">Billing — Internal / Canceled</div>
          <div class="stat-value">{metrics.internalTenants + metrics.canceledTenants}</div>
          <div class="muted" style="margin-top:8px;">{metrics.internalTenants} internal · {metrics.canceledTenants} canceled</div>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:14px;">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Health Signals</div>
          <div class="list">
            <div class="list-item"><strong>Stable:</strong> Active billing, recent workspace activity, and no urgent support signal.</div>
            <div class="list-item"><strong>Watch:</strong> Incomplete onboarding, low recent activity, or normal open support work.</div>
            <div class="list-item"><strong>At Risk:</strong> Past due / canceled billing, critical ticket, or no recent activity paired with weak setup.</div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Operational Focus</div>
          <div class="list">
            <div class="list-item"><strong>Billing follow-up:</strong> {metrics.pastDueTenants} tenant(s) currently show past-due billing.</div>
            <div class="list-item"><strong>Activation work:</strong> {metrics.onboardingInProgressTenants + metrics.onboardingNotStartedTenants} tenant(s) still need onboarding progress.</div>
            <div class="list-item"><strong>Support load:</strong> {metrics.openSupportTickets} open ticket(s), including {metrics.criticalSupportTickets} critical.</div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Recent Tenants</div>
          <div class="list">
            {recentTenants.length ? recentTenants.map((tenant) => (
              <div class="list-item">
                <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:flex-start;">
                  <div>
                    <div style="font-weight:900;">{tenant.name}</div>
                    <div class="muted" style="margin-top:4px;">{tenant.subdomain}.hudson-business-solutions.com</div>
                    <div class="muted" style="margin-top:4px;">Created: {tenant.created_at || '—'}</div>
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <span class={badgeClass(tenant.billing_status, tenant.billing_exempt)}>
                      {tenant.billing_exempt ? 'internal' : tenant.billing_status}
                    </span>
                    <a class="btn" href={`/admin/tenants/${tenant.id}`}>Details</a>
                  </div>
                </div>
              </div>
            )) : (
              <div class="muted">No tenants found.</div>
            )}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:12px;">
          <div>
            <div style="font-weight:900; font-size:18px;">Tenant Health Snapshot</div>
            <div class="muted" style="margin-top:4px;">
              Prioritized by risk so you can quickly spot accounts needing billing, onboarding, or support follow-up.
            </div>
          </div>
          <a class="btn" href="/admin/activity">View activity log</a>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Risk</th>
                <th>Onboarding</th>
                <th>Billing</th>
                <th>Activity</th>
                <th>Support</th>
                <th>Users / Jobs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenantHealth.length ? tenantHealth.map((tenant) => (
                <tr>
                  <td>
                    <div style="font-weight:900;">{tenant.name}</div>
                    <div class="muted" style="margin-top:4px;">{tenant.subdomain}.hudson-business-solutions.com</div>
                    <div class="muted" style="margin-top:4px;">Created: {tenant.created_at || '—'}</div>
                  </td>
                  <td>
                    <div><span class={riskBadgeClass(tenant.risk_level)}>{riskLabel(tenant.risk_level)}</span></div>
                    <div class="muted" style="margin-top:6px; line-height:1.5;">{tenant.risk_summary}</div>
                  </td>
                  <td>
                    <div>
                      <span class={onboardingBadgeClass(tenant.onboarding_status)}>
                        {onboardingLabel(tenant.onboarding_status)}
                      </span>
                    </div>
                    <div class="muted" style="margin-top:6px;">
                      {tenant.onboarding_completed_steps}/{tenant.onboarding_total_steps} steps complete
                    </div>
                    <div class="muted" style="margin-top:4px;">
                      Employees: {tenant.employee_count} · Invoices: {tenant.invoice_count}
                    </div>
                  </td>
                  <td>
                    <div>
                      <span class={badgeClass(tenant.billing_status, tenant.billing_exempt)}>
                        {tenant.billing_exempt ? 'internal' : tenant.billing_status}
                      </span>
                    </div>
                    <div style="margin-top:6px;">
                      <span class={billingStateBadgeClass(tenant.billing_state)}>
                        {tenant.billing_state || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:900;">{tenant.recent_activity_count_7d} / 7d</div>
                    <div class="muted" style="margin-top:4px;">{tenant.recent_activity_count_30d} / 30d</div>
                    <div class="muted" style="margin-top:4px;">Last: {tenant.last_activity_at || 'No activity logged'}</div>
                  </td>
                  <td>
                    <div style="font-weight:900;">{tenant.open_support_count} open</div>
                    <div class="muted" style="margin-top:4px;">{tenant.critical_support_count} critical</div>
                  </td>
                  <td>
                    <div style="font-weight:900;">{tenant.active_user_count}/{tenant.user_count} active users</div>
                    <div class="muted" style="margin-top:4px;">{tenant.job_count} jobs</div>
                  </td>
                  <td>
                    <a class="btn" href={`/admin/tenants/${tenant.id}`}>Open</a>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} class="muted">No tenants found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;