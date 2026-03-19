import type { FC } from 'hono/jsx';
import { getBillingAccess, resolveEffectiveBillingState } from '../../services/billing-access.js';

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
  billing_state?: string | null;
  billing_grace_until?: string | null;
  billing_override_reason?: string | null;
  billing_overridden_at?: string | null;
};

type BillingNotice = {
  tone: 'info' | 'good' | 'warn' | 'bad';
  message: string;
};

interface BillingPageProps {
  tenant: BillingTenant;
  csrfToken: string;
  currentUserRole: string;
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

function stateBadgeClass(state: string): string {
  const value = String(state || '').trim().toLowerCase();
  if (value === 'active' || value === 'internal' || value === 'billing_exempt') return 'badge badge-good';
  if (value === 'trialing' || value === 'past_due' || value === 'grace_period') return 'badge badge-warn';
  if (value === 'suspended' || value === 'canceled') return 'badge badge-bad';
  return 'badge';
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
}) => {
  const trialDays = daysRemaining(tenant.billing_trial_ends_at);
  const graceDays = daysRemaining(tenant.billing_grace_until || tenant.billing_grace_ends_at);
  const planLabel = tenant.billing_plan || 'standard';
  const isAdmin = currentUserRole === 'Admin';
  const hasCustomer = !!tenant.billing_customer_id;
  const effectiveState = resolveEffectiveBillingState({
    billing_exempt: tenant.billing_exempt,
    billing_status: tenant.billing_status,
    billing_trial_ends_at: tenant.billing_trial_ends_at,
    billing_grace_ends_at: tenant.billing_grace_ends_at,
    billing_state: tenant.billing_state || null,
    billing_grace_until: tenant.billing_grace_until || null,
  });
  const access = getBillingAccess({
    billing_exempt: tenant.billing_exempt,
    billing_status: tenant.billing_status,
    billing_trial_ends_at: tenant.billing_trial_ends_at,
    billing_grace_ends_at: tenant.billing_grace_ends_at,
    billing_state: tenant.billing_state || null,
    billing_grace_until: tenant.billing_grace_until || null,
  });
  const legacyDisplay = tenant.billing_exempt ? 'internal' : tenant.billing_status;
  const advancedDisplay = effectiveState === 'exempt' ? 'billing_exempt' : effectiveState;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Billing</h1>
          <p>
            Manage workspace billing, review the advanced enforcement state, and recover access when billing changes.
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
            Effective Access
          </div>
          <div style="font-size:24px; font-weight:900; margin-top:8px;">
            {access.allowed ? 'Allowed' : 'Restricted'}
          </div>
          <div class="muted" style="margin-top:6px;">
            Advanced state: {humanStatus(advancedDisplay)}
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
              <span class={stateBadgeClass(advancedDisplay)}>{humanStatus(advancedDisplay)}</span>
            </div>

            <div class="muted">
              Trial ends: <b style="color:#0F172A;">{formatDateTime(tenant.billing_trial_ends_at)}</b>
              {trialDays !== null ? ` (${trialDays} day${trialDays === 1 ? '' : 's'} remaining)` : ''}
            </div>

            <div class="muted">
              Grace until: <b style="color:#0F172A;">{formatDateTime(tenant.billing_grace_until || tenant.billing_grace_ends_at)}</b>
              {graceDays !== null ? ` (${graceDays} day${graceDays === 1 ? '' : 's'} remaining)` : ''}
            </div>

            <div class="muted">
              Last billing update: <b style="color:#0F172A;">{formatDateTime(tenant.billing_updated_at)}</b>
            </div>

            <div class="muted">
              Override applied: <b style="color:#0F172A;">{formatDateTime(tenant.billing_overridden_at)}</b>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Stripe actions</h3>

          <div style="display:grid; gap:12px;">
            <div class="muted">
              Webhooks keep the legacy billing record synced automatically after checkout, renewals, payment failures, and cancellations.
            </div>

            <div class="muted">
              Workspace plan target: <b style="color:#0F172A;">Hudson Business Solutions Pro</b>{' '}
              at <b style="color:#0F172A;">{stripePlanLabel}</b>
            </div>

            {!isAdmin ? (
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
        <h3 style="margin-top:0;">Legacy vs advanced billing</h3>

        <div class="table-wrap">
          <table>
            <tbody>
              <tr>
                <th>Legacy Billing Exempt</th>
                <td>{tenant.billing_exempt ? 'Yes' : 'No'}</td>
              </tr>
              <tr>
                <th>Legacy Billing Status</th>
                <td>{tenant.billing_status}</td>
              </tr>
              <tr>
                <th>Advanced Billing State</th>
                <td>{tenant.billing_state || 'Not set'}</td>
              </tr>
              <tr>
                <th>Advanced Grace Until</th>
                <td>{tenant.billing_grace_until || 'Not set'}</td>
              </tr>
              <tr>
                <th>Override Reason</th>
                <td>{tenant.billing_override_reason || 'Not set'}</td>
              </tr>
              <tr>
                <th>Effective Access Decision</th>
                <td>{access.allowed ? 'Allowed' : 'Restricted'}</td>
              </tr>
              <tr>
                <th>Effective Access State</th>
                <td>{advancedDisplay}</td>
              </tr>
              <tr>
                <th>Billing Plan</th>
                <td>{tenant.billing_plan || 'standard'}</td>
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
