import type { FC } from 'hono/jsx';

type BillingTenant = {
  name: string;
  subdomain: string;
  billing_exempt: number;
  billing_status: string;
  billing_plan: string | null;
  billing_trial_ends_at: string | null;
  billing_grace_ends_at: string | null;
  billing_customer_id: string | null;
  billing_subscription_id: string | null;
  billing_subscription_status: string | null;
  billing_updated_at: string | null;
};

interface BillingPageProps {
  tenant: BillingTenant;
  blockedReason?: string;
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Not set';
  const parsed = new Date(raw.includes('T') ? raw : `${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysRemaining(value: string | null | undefined): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw.includes('T') ? raw : `${raw}T23:59:59Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function humanStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function reasonMessage(reason: string | undefined): string | null {
  switch (reason) {
    case 'trial-ended':
      return 'This workspace trial has ended. Stripe billing is the next step before regular access can continue.';
    case 'grace-ended':
      return 'This workspace is past due and the grace period has ended. A valid subscription is required for full access.';
    case 'subscription-canceled':
      return 'This workspace subscription has been canceled. Reactivation will require billing setup.';
    case 'payment-required':
      return 'Billing must be completed before this workspace can continue using the platform.';
    default:
      return null;
  }
}

export const BillingPage: FC<BillingPageProps> = ({ tenant, blockedReason }) => {
  const trialDays = daysRemaining(tenant.billing_trial_ends_at);
  const graceDays = daysRemaining(tenant.billing_grace_ends_at);
  const planLabel = tenant.billing_plan || 'standard';
  const blockedMessage = reasonMessage(blockedReason);

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Billing</h1>
          <p>Billing foundation is now active for this workspace. Stripe checkout is the next implementation step.</p>
        </div>
      </div>

      {blockedMessage ? (
        <div class="card" style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">
          {blockedMessage}
        </div>
      ) : null}

      <div class="grid grid-3" style="margin-bottom:14px;">
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Workspace</div>
          <div style="font-size:24px; font-weight:900; margin-top:8px;">{tenant.name}</div>
          <div class="muted" style="margin-top:6px;">{tenant.subdomain}</div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Billing Status</div>
          <div style="font-size:24px; font-weight:900; margin-top:8px;">{tenant.billing_exempt ? 'Exempt' : humanStatus(tenant.billing_status)}</div>
          <div class="muted" style="margin-top:6px;">Plan: {humanStatus(planLabel)}</div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">Stripe Readiness</div>
          <div style="font-size:24px; font-weight:900; margin-top:8px;">Foundation Ready</div>
          <div class="muted" style="margin-top:6px;">Customer/subscription IDs can be attached next.</div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <h3 style="margin-top:0;">Current access state</h3>
          <div style="display:grid; gap:10px;">
            <div>
              <span class={tenant.billing_exempt ? 'badge badge-good' : 'badge'}>
                {tenant.billing_exempt ? 'Billing Exempt' : humanStatus(tenant.billing_status)}
              </span>
            </div>

            <div class="muted">
              Trial ends: <b style="color:#0F172A;">{formatDate(tenant.billing_trial_ends_at)}</b>
              {trialDays !== null ? ` (${trialDays} day${trialDays === 1 ? '' : 's'} remaining)` : ''}
            </div>

            <div class="muted">
              Grace ends: <b style="color:#0F172A;">{formatDate(tenant.billing_grace_ends_at)}</b>
              {graceDays !== null ? ` (${graceDays} day${graceDays === 1 ? '' : 's'} remaining)` : ''}
            </div>

            <div class="muted">
              Last billing update: <b style="color:#0F172A;">{formatDate(tenant.billing_updated_at)}</b>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Recommended next implementation</h3>
          <ol style="margin:0 0 0 18px; padding:0; line-height:1.8; color:#334155;">
            <li>Create a Stripe product and monthly price for the Standard plan.</li>
            <li>Save Stripe customer and subscription IDs back to the tenant record.</li>
            <li>Send admins here when a trial ends or payment fails.</li>
            <li>Keep internal/demo workspaces exempt using the billing_exempt flag.</li>
          </ol>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <h3 style="margin-top:0;">Current stored billing fields</h3>
        <div class="table-wrap">
          <table>
            <tbody>
              <tr>
                <th>Billing Exempt</th>
                <td>{tenant.billing_exempt ? 'Yes' : 'No'}</td>
              </tr>
              <tr>
                <th>Billing Plan</th>
                <td>{tenant.billing_plan || 'standard'}</td>
              </tr>
              <tr>
                <th>Billing Status</th>
                <td>{tenant.billing_status}</td>
              </tr>
              <tr>
                <th>Stripe Customer ID</th>
                <td>{tenant.billing_customer_id || 'Not connected yet'}</td>
              </tr>
              <tr>
                <th>Stripe Subscription ID</th>
                <td>{tenant.billing_subscription_id || 'Not connected yet'}</td>
              </tr>
              <tr>
                <th>Stripe Subscription Status</th>
                <td>{tenant.billing_subscription_status || 'Not connected yet'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
