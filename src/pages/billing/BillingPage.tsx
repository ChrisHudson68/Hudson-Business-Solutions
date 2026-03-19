import type { FC } from 'hono/jsx';
import { getBillingAccess, resolveEffectiveBillingState } from '../../services/billing-access.js';

/* ——— SAME TYPES AS BEFORE ——— */

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

/* ——— Helpers unchanged ——— */

function humanStatus(status: string): string {
  return status
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function stateBadgeClass(state: string): string {
  const v = state.toLowerCase();
  if (v === 'active' || v === 'internal' || v === 'billing_exempt') return 'badge badge-good';
  if (v === 'trialing' || v === 'past_due' || v === 'grace_period') return 'badge badge-warn';
  if (v === 'suspended' || v === 'canceled') return 'badge badge-bad';
  return 'badge';
}

function recoveryMessage(state: string): string | null {
  switch (state) {
    case 'trialing':
      return 'Your trial has ended. Start billing to restore full access.';
    case 'past_due':
      return 'Your payment is past due. Update billing to prevent suspension.';
    case 'grace_period':
      return 'Your workspace is in a temporary grace period. Update billing soon to avoid interruption.';
    case 'suspended':
      return 'This workspace is suspended. Billing must be updated before access can be restored.';
    case 'canceled':
      return 'The subscription is canceled. Restart billing to regain access.';
    default:
      return null;
  }
}

/* ——— PAGE ——— */

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

  const recovery = recoveryMessage(effectiveState);
  const isAdmin = currentUserRole === 'Admin';
  const hasCustomer = !!tenant.billing_customer_id;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Billing</h1>
          <p>Update billing to restore or maintain workspace access.</p>
        </div>
      </div>

      {notice ? (
        <div class="card" style="margin-bottom:14px;">
          {notice.message}
        </div>
      ) : null}

      {!access.allowed && recovery ? (
        <div class="card" style="margin-bottom:14px; background:#FEF2F2;">
          <strong>{recovery}</strong>
        </div>
      ) : null}

      <div class="grid grid-2">
        <div class="card">
          <h3 style="margin-top:0;">Access status</h3>

          <span class={stateBadgeClass(effectiveState)}>
            {humanStatus(effectiveState)}
          </span>

          <div class="muted" style="margin-top:10px;">
            Effective access: <b>{access.allowed ? 'Allowed' : 'Restricted'}</b>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Billing actions</h3>

          {!isAdmin ? (
            <div class="muted">
              Only workspace admins can update billing.
            </div>
          ) : !stripeEnabled ? (
            <div class="muted">
              Stripe billing is not enabled.
            </div>
          ) : (
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <form method="post" action="/billing/checkout">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button class="btn btn-primary" type="submit">
                  Start Checkout
                </button>
              </form>

              {stripePortalEnabled && hasCustomer && (
                <form method="post" action="/billing/portal">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn" type="submit">
                    Open Billing Portal
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingPage;