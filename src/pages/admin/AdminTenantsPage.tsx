import type { FC } from 'hono/jsx';

interface AdminTenantRow {
  id: number;
  name: string;
  subdomain: string;
  created_at: string | null;
  billing_exempt: number;
  billing_status: string;
  billing_plan: string | null;
  billing_trial_ends_at: string | null;
  user_count: number;
  job_count: number;
}

interface AdminTenantsPageProps {
  tenants: AdminTenantRow[];
}

function badgeClass(status: string, exempt: number): string {
  if (Number(exempt) === 1 || status === 'internal') return 'badge badge-good';
  if (status === 'active') return 'badge badge-good';
  if (status === 'trialing') return 'badge badge-warn';
  if (status === 'past_due') return 'badge badge-bad';
  if (status === 'canceled') return 'badge badge-bad';
  return 'badge';
}

export const AdminTenantsPage: FC<AdminTenantsPageProps> = ({ tenants }) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>All Tenants</h1>
          <p>Cross-tenant visibility for support, billing, and operations.</p>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Billing</th>
                <th>Plan</th>
                <th>Users</th>
                <th>Jobs</th>
                <th>Trial Ends</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.length ? tenants.map((tenant) => (
                <tr>
                  <td>
                    <div style="font-weight:900;">{tenant.name}</div>
                    <div class="muted" style="margin-top:4px;">
                      {tenant.subdomain}.hudson-business-solutions.com
                    </div>
                  </td>
                  <td>
                    <span class={badgeClass(tenant.billing_status, tenant.billing_exempt)}>
                      {tenant.billing_exempt ? 'internal' : tenant.billing_status}
                    </span>
                  </td>
                  <td>{tenant.billing_plan || '—'}</td>
                  <td>{tenant.user_count}</td>
                  <td>{tenant.job_count}</td>
                  <td>{tenant.billing_trial_ends_at || '—'}</td>
                  <td>{tenant.created_at || '—'}</td>
                  <td>
                    <a class="btn" href={`/admin/tenants/${tenant.id}`}>View</a>
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

export default AdminTenantsPage;