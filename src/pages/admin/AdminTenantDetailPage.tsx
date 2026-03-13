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
  workspaceLoginUrl: string;
}

function badgeClass(status: string, exempt: number): string {
  if (Number(exempt) === 1 || status === 'internal') return 'badge badge-good';
  if (status === 'active') return 'badge badge-good';
  if (status === 'trialing') return 'badge badge-warn';
  if (status === 'past_due') return 'badge badge-bad';
  if (status === 'canceled') return 'badge badge-bad';
  return 'badge';
}

export const AdminTenantDetailPage: FC<AdminTenantDetailPageProps> = ({
  tenant,
  workspaceLoginUrl,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{tenant.name}</h1>
          <p>Cross-tenant detail view for support and billing operations.</p>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <a class="btn" href="/admin/tenants">Back to Tenants</a>
          <a class="btn btn-primary" href={workspaceLoginUrl}>Open Workspace</a>
        </div>
      </div>

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
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Default Rates</div>
          <div class="list">
            <div class="list-item"><strong>Default Tax Rate:</strong> {tenant.default_tax_rate ?? '—'}</div>
            <div class="list-item"><strong>Default Labor Rate:</strong> {tenant.default_labor_rate ?? '—'}</div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Support Note</div>
          <div class="muted" style="line-height:1.7;">
            This first version is intentionally read-only. Once this is working cleanly, the next safe additions are:
            billing-exempt toggles, trial extensions, tenant suspension, and audited impersonation.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTenantDetailPage;