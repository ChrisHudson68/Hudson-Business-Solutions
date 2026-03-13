import type { FC } from 'hono/jsx';

interface RecentTenant {
  id: number;
  name: string;
  subdomain: string;
  created_at: string | null;
  billing_status: string;
  billing_exempt: number;
}

interface AdminDashboardPageProps {
  metrics: {
    totalTenants: number;
    activeTenants: number;
    trialingTenants: number;
    internalTenants: number;
    pastDueTenants: number;
    canceledTenants: number;
  };
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

export const AdminDashboardPage: FC<AdminDashboardPageProps> = ({
  metrics,
  recentTenants,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Platform Overview</h1>
          <p>Read-only visibility across all workspaces and billing states.</p>
        </div>
      </div>

      <div class="grid grid-4">
        <div class="card">
          <div class="stat-label">Total Tenants</div>
          <div class="stat-value">{metrics.totalTenants}</div>
        </div>

        <div class="card">
          <div class="stat-label">Active</div>
          <div class="stat-value">{metrics.activeTenants}</div>
        </div>

        <div class="card">
          <div class="stat-label">Trialing</div>
          <div class="stat-value">{metrics.trialingTenants}</div>
        </div>

        <div class="card">
          <div class="stat-label">Internal / Exempt</div>
          <div class="stat-value">{metrics.internalTenants}</div>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:14px;">
        <div class="card">
          <div class="stat-label">Past Due</div>
          <div class="stat-value">{metrics.pastDueTenants}</div>
        </div>

        <div class="card">
          <div class="stat-label">Canceled</div>
          <div class="stat-value">{metrics.canceledTenants}</div>
        </div>

        <div class="card">
          <div class="stat-label">Next Step</div>
          <div style="font-size:15px; font-weight:800; margin-top:10px;">Wire billing into Stripe</div>
          <div class="muted" style="margin-top:8px; line-height:1.6;">
            This portal is ready to become your operator view for support, trial handling, and billing state visibility.
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;">
          <div>
            <div style="font-weight:900; font-size:18px;">Recent Tenants</div>
            <div class="muted" style="margin-top:4px;">Newest workspaces across the platform.</div>
          </div>
          <a class="btn" href="/admin/tenants">View all tenants</a>
        </div>

        <div class="list">
          {recentTenants.length ? recentTenants.map((tenant) => (
            <div class="list-item">
              <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                <div>
                  <div style="font-weight:900;">{tenant.name}</div>
                  <div class="muted" style="margin-top:4px;">
                    {tenant.subdomain}.hudson-business-solutions.com
                  </div>
                  <div class="muted" style="margin-top:4px;">
                    Created: {tenant.created_at || 'Unknown'}
                  </div>
                </div>

                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
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
  );
};

export default AdminDashboardPage;