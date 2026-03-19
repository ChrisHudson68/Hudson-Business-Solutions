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

function humanStatus(status: string): string {
  return String(status || '')
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function stateBadgeClass(state: string): string {
  const v = String(state || '').toLowerCase();
  if (v === 'active' || v === 'internal' || v === 'billing_exempt') return 'badge badge-good';
  if (v === 'trialing' || v === 'past_due' || v === 'grace_period') return 'badge badge-warn';
  if (v === 'suspended' || v === 'canceled') return 'badge badge-bad';
  return 'badge';
}

function noticeCardStyle(tone: BillingNotice['tone']): string {
  if (tone === 'good') return 'margin-bottom:14px; background:#F0FDF4; border:1px solid #BBF7D0;';
  if (tone === 'warn') return 'margin-bottom:14px; background:#FFF7ED; border:1px solid #FED7AA;';
  if (tone === 'bad') return 'margin-bottom:14px; background:#FEF2F2; border:1px solid #FECACA;';
  return 'margin-bottom:14px; background:#EFF6FF; border:1px solid #BFDBFE;';
}

function formatDateTime(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);

  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '—';

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);

  if (Number.isNaN(parsed.getTime())) return raw;

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysUntil(value: string | null | undefined): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const diffMs = parsed.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function buildStatusHeadline(state: string): string {
  switch (state) {
    case 'active':
      return 'Your workspace billing is active.';
    case 'trialing':
      return 'Your workspace is currently on trial.';
    case 'past_due':
      return 'Your workspace billing needs attention.';
    case 'grace_period':
      return 'Your workspace is in a temporary grace period.';
    case 'suspended':
      return 'Your workspace is suspended for billing reasons.';
    case 'canceled':
      return 'Your workspace subscription is canceled.';
    case 'internal':
    case 'billing_exempt':
      return 'This workspace does not currently require Stripe billing.';
    default:
      return 'Review your workspace billing status below.';
  }
}

function buildStatusDetail(state: string, tenant: BillingTenant): string {
  if (state === 'active') {
    return tenant.billing_subscription_id
      ? 'Your subscription is connected and your team should continue to have normal access.'
      : 'Billing is marked active. If you need to update payment details, open the billing portal.';
  }

  if (state === 'trialing') {
    const remaining = daysUntil(tenant.billing_trial_ends_at);
    if (remaining === null) {
      return 'Set up billing before the trial ends so access continues without interruption.';
    }
    if (remaining <= 0) {
      return 'The recorded trial end date has passed. Complete billing now to restore or protect workspace access.';
    }
    if (remaining === 1) {
      return `Your trial ends tomorrow on ${formatDateOnly(tenant.billing_trial_ends_at)}.`;
    }
    return `Your trial ends in ${remaining} day${remaining === 1 ? '' : 's'} on ${formatDateOnly(tenant.billing_trial_ends_at)}.`;
  }

  if (state === 'past_due' || state === 'grace_period') {
    const graceDate = tenant.billing_grace_until || tenant.billing_grace_ends_at;
    const remaining = daysUntil(graceDate);
    if (remaining === null) {
      return 'Update your payment method as soon as possible to avoid service interruption.';
    }
    if (remaining <= 0) {
      return `The grace window ended on ${formatDateOnly(graceDate)}. Billing should be updated immediately.`;
    }
    return `The current grace window ends in ${remaining} day${remaining === 1 ? '' : 's'} on ${formatDateOnly(graceDate)}.`;
  }

  if (state === 'suspended') {
    return 'Only billing recovery actions should remain available until payment is corrected.';
  }

  if (state === 'canceled') {
    return 'Restart billing to continue using the workspace without interruption.';
  }

  return 'No action is currently required.';
}

function nextActionLabel(state: string, isAdmin: boolean, stripeEnabled: boolean, hasCustomer: boolean): string {
  if (!isAdmin) return 'Contact a workspace admin to make billing changes.';
  if (!stripeEnabled) return 'Stripe billing is not configured yet.';
  if (state === 'internal' || state === 'billing_exempt') return 'This workspace is billing-exempt.';
  if (state === 'active' && hasCustomer) return 'Open the billing portal to update payment details or invoices.';
  if (state === 'active') return 'Billing is active. Use checkout only if a Stripe customer still needs to be created.';
  if (state === 'trialing') return 'Start billing before the trial expires.';
  if (state === 'past_due' || state === 'grace_period') return 'Update billing now to avoid suspension.';
  if (state === 'suspended' || state === 'canceled') return 'Restart billing now to restore normal access.';
  return 'Review the billing actions below.';
}

function canStartCheckout(state: string, isAdmin: boolean, stripeEnabled: boolean): boolean {
  if (!isAdmin || !stripeEnabled) return false;
  return state !== 'internal' && state !== 'billing_exempt';
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
  const hasSubscription = !!tenant.billing_subscription_id;
  const displayPlan = tenant.billing_plan || stripePlanLabel || 'Standard';
  const accessLabel = access.allowed ? 'Allowed' : 'Restricted';
  const headline = buildStatusHeadline(effectiveState);
  const detail = buildStatusDetail(effectiveState, tenant);
  const nextAction = nextActionLabel(effectiveState, isAdmin, stripeEnabled, hasCustomer);
  const showCheckout = canStartCheckout(effectiveState, isAdmin, stripeEnabled);
  const showPortal = isAdmin && stripeEnabled && stripePortalEnabled && hasCustomer;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Billing</h1>
          <p>Clear subscription status, recovery guidance, and billing actions for this workspace.</p>
        </div>
      </div>

      {notice ? (
        <div class="card" style={noticeCardStyle(notice.tone)}>
          <strong>{notice.message}</strong>
        </div>
      ) : null}

      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:flex-start;">
          <div>
            <div style="font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#64748B;">Workspace status</div>
            <div style="font-size:24px; font-weight:900; margin-top:6px;">{headline}</div>
            <div class="muted" style="margin-top:8px; max-width:760px; line-height:1.6;">{detail}</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <span class={stateBadgeClass(effectiveState)}>{humanStatus(effectiveState)}</span>
            <span class={access.allowed ? 'badge badge-good' : 'badge badge-bad'}>{accessLabel}</span>
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Subscription overview</div>

          <div class="list">
            <div class="list-item">
              <strong>Plan:</strong> {displayPlan}
            </div>
            <div class="list-item">
              <strong>Stripe mode:</strong> {stripeModeLabel}
            </div>
            <div class="list-item">
              <strong>Subscription status:</strong> {tenant.billing_subscription_status ? humanStatus(tenant.billing_subscription_status) : 'Not yet connected'}
            </div>
            <div class="list-item">
              <strong>Trial ends:</strong> {formatDateOnly(tenant.billing_trial_ends_at)}
            </div>
            <div class="list-item">
              <strong>Grace period ends:</strong> {formatDateOnly(tenant.billing_grace_until || tenant.billing_grace_ends_at)}
            </div>
            <div class="list-item">
              <strong>Last billing sync:</strong> {formatDateTime(tenant.billing_updated_at)}
            </div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Recommended next step</div>
          <div class="muted" style="line-height:1.6; margin-bottom:14px;">{nextAction}</div>

          {!isAdmin ? (
            <div class="muted">Only workspace admins can update billing or payment details.</div>
          ) : !stripeEnabled ? (
            <div class="muted">Stripe billing is not enabled in this environment yet.</div>
          ) : (
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              {showCheckout ? (
                <form method="post" action="/billing/checkout">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn btn-primary" type="submit">
                    {hasSubscription ? 'Restart / Replace Subscription' : 'Start Billing'}
                  </button>
                </form>
              ) : null}

              {showPortal ? (
                <form method="post" action="/billing/portal">
                  <input type="hidden" name="csrf_token" value={csrfToken} />
                  <button class="btn" type="submit">
                    Manage Billing
                  </button>
                </form>
              ) : null}
            </div>
          )}

          <div class="muted" style="margin-top:14px; line-height:1.6;">
            Use <strong>Start Billing</strong> when the workspace still needs to begin or restart a paid subscription.
            Use <strong>Manage Billing</strong> to update payment methods, invoices, or subscription details in Stripe.
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px;">
        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">What this status means</div>

          <div class="list">
            <div class="list-item"><strong>Active:</strong> Billing is in good standing and access should continue normally.</div>
            <div class="list-item"><strong>Trialing:</strong> The workspace is still in its trial window and should start billing before it ends.</div>
            <div class="list-item"><strong>Past Due / Grace Period:</strong> Payment needs attention and service interruption may follow if not corrected.</div>
            <div class="list-item"><strong>Suspended / Canceled:</strong> Billing recovery is required before normal use continues.</div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Billing connection details</div>

          <div class="list">
            <div class="list-item"><strong>Stripe customer:</strong> {hasCustomer ? 'Connected' : 'Not created yet'}</div>
            <div class="list-item"><strong>Stripe subscription:</strong> {hasSubscription ? 'Connected' : 'Not created yet'}</div>
            <div class="list-item"><strong>Workspace:</strong> {tenant.name}</div>
            <div class="list-item"><strong>Subdomain:</strong> {tenant.subdomain}</div>
          </div>
        </div>
      </div>

      {(tenant.billing_override_reason || tenant.billing_overridden_at) ? (
        <div class="card" style="margin-top:14px;">
          <div style="font-weight:900; font-size:18px; margin-bottom:12px;">Admin billing override</div>
          <div class="muted" style="line-height:1.6;">
            {tenant.billing_override_reason
              ? `Platform note: ${tenant.billing_override_reason}`
              : 'A platform-level billing override is recorded for this workspace.'}
          </div>
          {tenant.billing_overridden_at ? (
            <div class="muted" style="margin-top:8px;">Recorded: {formatDateTime(tenant.billing_overridden_at)}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default BillingPage;
