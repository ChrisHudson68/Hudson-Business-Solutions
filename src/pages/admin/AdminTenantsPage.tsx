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
  impersonatable_user_count: number;
  first_impersonatable_user_id: number | null;
  first_impersonatable_user_name: string | null;
  first_impersonatable_user_role: string | null;
}

interface AdminTenantsPageProps {
  tenants: AdminTenantRow[];
  csrfToken: string;
  search: string;
}

function badgeClass(status: string, exempt: number): string {
  if (Number(exempt) === 1 || status === 'internal') return 'badge badge-good';
  if (status === 'active') return 'badge badge-good';
  if (status === 'trialing') return 'badge badge-warn';
  if (status === 'past_due') return 'badge badge-bad';
  if (status === 'canceled') return 'badge badge-bad';
  return 'badge';
}

export const AdminTenantsPage: FC<AdminTenantsPageProps> = ({ tenants, csrfToken, search }) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>All Tenants</h1>
          <p>Cross-tenant visibility for support, billing, and operations.</p>
        </div>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <form method="get" action="/admin/tenants" style="display:grid; gap:12px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:end;">
            <div style="flex:1 1 320px; min-width:240px;">
              <label style="display:block; font-weight:800; margin-bottom:6px;">Search tenants</label>
              <input
                type="text"
                name="q"
                value={search}
                placeholder="Search by tenant name or subdomain"
                style="width:100%; min-height:40px; padding:10px 12px; border:1px solid var(--border); border-radius:12px;"
              />
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-primary" type="submit">Apply</button>
              {search ? <a class="btn" href="/admin/tenants">Clear</a> : null}
            </div>
          </div>

          <div class="muted" style="line-height:1.6;">
            Quick impersonation uses the first eligible non-Admin active user for that tenant. Open the tenant detail page for exact user selection and search.
          </div>
        </form>
      </div>

      <div class="card">
        <div class="table-wrap" style="margin:0 -18px -16px;">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Billing</th>
                <th>Plan</th>
                <th>Users</th>
                <th>Jobs</th>
                <th>Eligible Support Users</th>
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
                  <td>
                    <div style="font-weight:900;">{tenant.impersonatable_user_count}</div>
                    <div class="muted" style="margin-top:4px;">
                      {tenant.first_impersonatable_user_name
                        ? `${tenant.first_impersonatable_user_name} (${tenant.first_impersonatable_user_role})`
                        : 'No quick user available'}
                    </div>
                  </td>
                  <td>{tenant.billing_trial_ends_at || '—'}</td>
                  <td>{tenant.created_at || '—'}</td>
                  <td>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                      <a class="btn" href={`/admin/tenants/${tenant.id}`}>View</a>

                      {tenant.first_impersonatable_user_id ? (
                        <form method="post" action={`/admin/tenants/${tenant.id}/impersonate`} style="margin:0; display:inline;">
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <input type="hidden" name="user_id" value={tenant.first_impersonatable_user_id} />
                          <input type="hidden" name="support_reason" value="Quick support access from tenant directory" />
                          <button class="btn btn-primary" type="submit">Quick Impersonate</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} class="muted">No tenants found.</td>
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
