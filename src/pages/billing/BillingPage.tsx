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

type BillingNotice = {
  tone: 'info' | 'good' | 'warn' | 'bad';
  message: string;
};

interface BillingPageProps {
  tenant: BillingTenant;
  csrfToken: string;
  currentUserRole: string;
  canManageBilling?: boolean;
  stripeEnabled: boolean;
  stripeModeLabel: string;
  stripePortalEnabled: boolean;
  stripePlanLabel: string;
  notice?: BillingNotice;
}

function formatDateTime(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Not set';

  const parsed = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function daysRemaining(value: string | null | undefined): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parsed = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  return Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function humanStatus(status: string): string {
  const raw = String(status || '').trim();
  if (!raw) return 'Unknown';

  return raw
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toneStyles(tone: BillingNotice['tone']): string {
  switch (tone) {
    case 'good':
      return 'margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;';
    case 'warn':
      return 'margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;';
    case 'bad':
      return 'margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;';
    default:
      return 'margin-bottom:14px; border-color:#BFDBFE; background:#EFF6FF; color:#1D4ED8;';
  }
}

export const BillingPage: FC<BillingPageProps> = ({
  tenant,
  csrfToken,
  currentUserRole,
  stripeEnabled,
  stripeModeLabel,
  stripePortalEnabled,
  stripePlanLabel,
  notice,
  canManageBilling,
}) => {
  const trialDays = daysRemaining(tenant.billing_trial_ends_at);
  const graceDays = daysRemaining(tenant.billing_grace_ends_at);
  const planLabel = tenant.billing_plan || 'standard';
  const hasCustomer = !!tenant.billing_customer_id;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Billing</h1>
          <p>
            Manage workspace billing, start Stripe checkout, and monitor webhook-synced subscription state.
          </p>
        </div>
      </div>

      {notice ? (
        <div class="card" style={toneStyles(notice.tone)}>
          {notice.message}
        </div>
      ) : null}

      <div class="grid grid-3" style="margin-bottom:14px;">
        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">
            Workspace
          </div>
          <div style="font-size:24px; font-weight:900; margin-top:8px;">{tenant.name}</div>
          <div class="muted" style="margin-top:6px;">{tenant.subdomain}</div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">
            Billing Status
          </div>
          <div style="font-size:24px; font-weight:900; margin-top:8px;">
            {tenant.billing_exempt ? 'Exempt' : humanStatus(tenant.billing_status)}
          </div>
          <div class="muted" style="margin-top:6px;">
            Plan: {humanStatus(planLabel)}
          </div>
        </div>

        <div class="card">
          <div class="muted" style="font-size:12px; font-weight:900; text-transform:uppercase;">
            Stripe Mode
          </div>
          <div style="font-size:24px; font-weight:900; margin-top:8px;">{stripeModeLabel}</div>
          <div class="muted" style="margin-top:6px;">
            {stripeEnabled ? `Checkout plan: ${stripePlanLabel}` : 'Stripe is not enabled yet.'}
          </div>
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
              Trial ends: <b style="color:#0F172A;">{formatDateTime(tenant.billing_trial_ends_at)}</b>
              {trialDays !== null ? ` (${trialDays} day${trialDays === 1 ? '' : 's'} remaining)` : ''}
            </div>

            <div class="muted">
              Grace ends: <b style="color:#0F172A;">{formatDateTime(tenant.billing_grace_ends_at)}</b>
              {graceDays !== null ? ` (${graceDays} day${graceDays === 1 ? '' : 's'} remaining)` : ''}
            </div>

            <div class="muted">
              Last billing update: <b style="color:#0F172A;">{formatDateTime(tenant.billing_updated_at)}</b>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Stripe actions</h3>

          <div style="display:grid; gap:12px;">
            <div class="muted">
              Webhooks are now intended to keep this billing record synced automatically after checkout,
              renewals, payment failures, and cancellations.
            </div>

            <div class="muted">
              Workspace plan target: <b style="color:#0F172A;">Hudson Business Solutions Pro</b>{' '}
              at <b style="color:#0F172A;">{stripePlanLabel}</b>
            </div>

            {!canManageBilling ? (
              <div class="card" style="padding:12px; background:#F8FAFC;">
                Only workspace admins can start checkout or open the billing portal.
              </div>
            ) : !stripeEnabled ? (
              <div class="card" style="padding:12px; background:#F8FAFC;">
                Stripe is currently disabled by configuration.
              </div>
            ) : (
              <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <form method="post" action="/billing/checkout" style="margin:0;">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn btn-primary" type="submit">
                    Start Checkout
                  </button>
                </form>

                {stripePortalEnabled && hasCustomer ? (
                  <form method="post" action="/billing/portal" style="margin:0;">
                    <input type="hidden" name="csrf_token" value={csrfToken} />
                    <button class="btn" type="submit">
                      Open Billing Portal
                    </button>
                  </form>
                ) : (
                  <button class="btn" type="button" disabled>
                    Billing Portal Unavailable
                  </button>
                )}
              </div>
            )}
          </div>
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

      <div class="card" style="margin-top:14px;">
        <h3 style="margin-top:0;">Webhook-driven sync</h3>
        <ol style="margin:0 0 0 18px; padding:0; line-height:1.8; color:#334155;">
          <li>Checkout creates or reuses one Stripe customer per tenant.</li>
          <li>Stripe sends subscription and invoice events to your webhook endpoint.</li>
          <li>Your app updates the tenant billing record in SQLite.</li>
          <li>Your billing middleware reads the local tenant record to decide access.</li>
        </ol>
      </div>
    </div>
  );
};

export default BillingPage;