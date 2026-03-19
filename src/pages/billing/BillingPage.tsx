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
  title?: string;
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

function humanStatus(status: string): string {
  return status
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function stateBadgeClass(state: string): string {
  const v = state.toLowerCase();
  if (v === 'active' || v === 'internal' || v === 'billing_exempt' || v === 'exempt') return 'badge badge-good';
  if (v === 'trialing' || v === 'past_due' || v === 'grace_period') return 'badge badge-warn';
  if (v === 'suspended' || v === 'canceled') return 'badge badge-bad';
  return 'badge';
}

function noticeCardStyle(tone: BillingNotice['tone']): string {
  if (tone === 'good') return 'margin-bottom:14px; border:1px solid #BBF7D0; background:#F0FDF4;';
  if (tone === 'warn') return 'margin-bottom:14px; border:1px solid #FDE68A; background:#FFFBEB;';
  if (tone === 'bad') return 'margin-bottom:14px; border:1px solid #FECACA; background:#FEF2F2;';
  return 'margin-bottom:14px; border:1px solid #BFDBFE; background:#EFF6FF;';
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';

  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusHeadline(state: string): string {
  switch (state) {
    case 'exempt':
    case 'billing_exempt':
      return 'Billing is not required for this workspace.';
    case 'internal':
      return 'This workspace is internally managed.';
    case 'active':
      return 'Your subscription is active.';
    case 'trialing':
      return 'Your workspace is currently in trial.';
    case 'past_due':
      return 'Your subscription needs payment attention.';
    case 'grace_period':
      return 'Your workspace is in a temporary recovery period.';
    case 'suspended':
      return 'Workspace access is suspended until billing is corrected.';
    case 'canceled':
      return 'The subscription is canceled.';
    default:
      return 'Billing information is available below.';
  }
}

function statusDescription(state: string, tenant: BillingTenant): string {
  switch (state) {
    case 'exempt':
    case 'billing_exempt':
      return 'Stripe checkout is not needed for this workspace because it is marked as billing-exempt.';
    case 'internal':
      return 'This workspace is being handled as an internal account rather than a standard customer subscription.';
    case 'active':
      return 'Billing is in good standing and the workspace should continue operating normally.';
    case 'trialing':
      return tenant.billing_trial_ends_at
        ? `The workspace is still in trial. The current trial end is ${formatDate(tenant.billing_trial_ends_at)}.`
        : 'The workspace is still in trial. When the trial ends, billing will need to be started to avoid interruption.';
    case 'past_due':
      return 'Stripe has marked the subscription as needing payment attention. Updating the payment method now helps avoid service interruption.';
    case 'grace_period':
      return tenant.billing_grace_until
        ? `A temporary grace period is active through ${formatDate(tenant.billing_grace_until)}.`
        : 'A temporary grace period is active, but billing should still be corrected soon to avoid suspension.';
    case 'suspended':
      return 'Workspace access has been limited because billing recovery is still required.';
    case 'canceled':
      return 'The previous subscription is no longer active. Starting billing again will create a new active subscription.';
    default:
      return 'Review the billing details below and use the available actions if changes are needed.';
  }
}

function primaryActionLabel(state: string): string {
  if (state === 'active' || state === 'past_due' || state === 'grace_period') return 'Manage Billing';
  if (state === 'exempt' || state === 'billing_exempt' || state === 'internal') return 'Billing Not Needed';
  return 'Start Billing';
}

function secondaryActionHint(state: string): string {
  if (state === 'active') return 'Use the billing portal to update payment details, invoices, or subscription information.';
  if (state === 'past_due' || state === 'grace_period') return 'Open the billing portal to update your payment method and recover the subscription.';
  if (state === 'suspended' || state === 'canceled') return 'Start billing again to restore or reactivate this workspace.';
  if (state === 'trialing') return 'When you are ready to convert the workspace to a paid subscription, start billing here.';
  if (state === 'exempt' || state === 'billing_exempt' || state === 'internal') return 'No customer billing action is expected for this workspace.';
  return 'Choose the billing action that fits the current workspace state.';
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

  const isAdmin = currentUserRole === 'Admin';
  const hasCustomer = !!tenant.billing_customer_id;
  const canUsePortal = isAdmin && stripeEnabled && stripePortalEnabled && hasCustomer;
  const canStartCheckout = isAdmin && stripeEnabled && effectiveState !== 'exempt' && effectiveState !== 'internal';

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Billing</h1>
          <p>Review subscription status, understand what it means, and take the right billing action for this workspace.</p>
        </div>
      </div>

      {notice ? (
        <div class="card" style={noticeCardStyle(notice.tone)}>
          {notice.title ? <div style="font-weight:900; margin-bottom:6px;">{notice.title}</div> : null}
          <div>{notice.message}</div>
        </div>
      ) : null}

      <div class="grid grid-2">
        <div class="card">
          <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start;">
            <div>
              <div class="stat-label">Subscription Status</div>
              <div style="font-size:24px; font-weight:900; margin-top:6px;">{statusHeadline(effectiveState)}</div>
            </div>
            <span class={stateBadgeClass(effectiveState)}>{humanStatus(effectiveState)}</span>
          </div>

          <div class="muted" style="margin-top:12px; line-height:1.6;">{statusDescription(effectiveState, tenant)}</div>

          <div style="margin-top:14px; display:grid; gap:10px;">
            <div>
              <strong>Workspace access:</strong> {access.allowed ? 'Allowed' : 'Restricted'}
            </div>
            {tenant.billing_trial_ends_at ? (
              <div class="muted">Trial ends: {formatDate(tenant.billing_trial_ends_at)}</div>
            ) : null}
            {tenant.billing_grace_until ? (
              <div class="muted">Grace period until: {formatDate(tenant.billing_grace_until)}</div>
            ) : null}
            {!tenant.billing_grace_until && tenant.billing_grace_ends_at ? (
              <div class="muted">Legacy grace date: {formatDate(tenant.billing_grace_ends_at)}</div>
            ) : null}
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:8px;">Billing Actions</div>
          <div class="muted" style="line-height:1.6; margin-bottom:14px;">
            {secondaryActionHint(effectiveState)}
          </div>

          {!isAdmin ? (
            <div class="muted">Only workspace admins can update billing or open the Stripe billing portal.</div>
          ) : !stripeEnabled ? (
            <div class="muted">Stripe billing is not enabled for this environment yet.</div>
          ) : (
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              {canStartCheckout ? (
                <form method="post" action="/billing/checkout">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn btn-primary" type="submit">
                    {primaryActionLabel(effectiveState)}
                  </button>
                </form>
              ) : (
                <button class="btn" type="button" disabled>
                  {primaryActionLabel(effectiveState)}
                </button>
              )}

              {canUsePortal ? (
                <form method="post" action="/billing/portal">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn" type="submit">Open Billing Portal</button>
                </form>
              ) : null}
            </div>
          )}

          <div class="muted" style="margin-top:14px; line-height:1.6;">
            <strong>Plan:</strong> {tenant.billing_plan || stripePlanLabel}
            <br />
            <strong>Stripe mode:</strong> {stripeModeLabel}
            <br />
            <strong>Portal:</strong> {stripePortalEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Subscription Details</div>

          <div class="list">
            <div class="list-item">
              <strong>Workspace:</strong>
              <div class="muted" style="margin-top:4px;">{tenant.name} ({tenant.subdomain})</div>
            </div>
            <div class="list-item">
              <strong>Effective state:</strong>
              <div class="muted" style="margin-top:4px;">{humanStatus(effectiveState)}</div>
            </div>
            <div class="list-item">
              <strong>Saved subscription status:</strong>
              <div class="muted" style="margin-top:4px;">{tenant.billing_subscription_status || tenant.billing_status || '—'}</div>
            </div>
            <div class="list-item">
              <strong>Last billing sync:</strong>
              <div class="muted" style="margin-top:4px;">{formatDate(tenant.billing_updated_at)}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Stripe Connection</div>

          <div class="list">
            <div class="list-item">
              <strong>Customer record</strong>
              <div class="muted" style="margin-top:4px;">{tenant.billing_customer_id || 'Not created yet'}</div>
            </div>
            <div class="list-item">
              <strong>Subscription record</strong>
              <div class="muted" style="margin-top:4px;">{tenant.billing_subscription_id || 'Not created yet'}</div>
            </div>
            <div class="list-item">
              <strong>Recommended next step</strong>
              <div class="muted" style="margin-top:4px;">{secondaryActionHint(effectiveState)}</div>
            </div>
          </div>
        </div>
      </div>

      {tenant.billing_override_reason || tenant.billing_overridden_at ? (
        <div class="card" style="margin-top:14px;">
          <div style="font-weight:900; font-size:18px; margin-bottom:10px;">Platform Billing Override</div>
          <div class="muted" style="line-height:1.6;">
            This workspace has platform-level billing override information saved. Tenant admins can view it here for clarity, but only platform administration should change override behavior.
          </div>
          {tenant.billing_override_reason ? (
            <div style="margin-top:12px;"><strong>Reason:</strong> {tenant.billing_override_reason}</div>
          ) : null}
          {tenant.billing_overridden_at ? (
            <div class="muted" style="margin-top:6px;">Last override update: {formatDate(tenant.billing_overridden_at)}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default BillingPage;
