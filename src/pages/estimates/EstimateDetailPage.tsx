import type { FC } from 'hono/jsx';
import type { EstimateWithLineItems } from '../../db/types.js';

interface EstimateDetailPageProps {
  estimate: EstimateWithLineItems;
  canEditEstimate?: boolean;
  canSendEstimate?: boolean;
  csrfToken?: string;
  publicUrl?: string | null;
  notice?: string;
  noticeTone?: 'info' | 'success' | 'danger';
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusBadgeClass(status: string): string {
  if (status === 'approved' || status === 'converted') return 'badge badge-good';
  if (status === 'rejected' || status === 'expired') return 'badge badge-bad';
  if (status === 'ready' || status === 'sent') return 'badge badge-warn';
  return 'badge';
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function noticeStyle(tone: 'info' | 'success' | 'danger' = 'info'): string {
  if (tone === 'success') {
    return 'margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;';
  }

  if (tone === 'danger') {
    return 'margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;';
  }

  return 'margin-bottom:14px; border-color:#BFDBFE; background:#EFF6FF; color:#1E3A8A;';
}

export const EstimateDetailPage: FC<EstimateDetailPageProps> = ({
  estimate,
  canEditEstimate,
  canSendEstimate,
  csrfToken,
  publicUrl,
  notice,
  noticeTone = 'info',
}) => {
  const totalBaseCost = estimate.line_items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);
  const grossMarkupValue = Number(estimate.subtotal || 0) - totalBaseCost;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{estimate.estimate_number}</h1>
          <p class="muted">Internal estimate detail and pricing review.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={estimate.archived_at ? '/estimates?show_archived=1' : '/estimates'}>Back</a>
          <a class="btn" href={`/estimate/${estimate.id}/pdf`}>Download Proposal PDF</a>
          {canEditEstimate ? (
            <a class="btn btn-primary" href={`/estimate/${estimate.id}/edit`}>Edit Estimate</a>
          ) : null}
          {csrfToken ? (
            estimate.archived_at ? (
              <form method="post" action={`/estimate/${estimate.id}/restore`} class="inline-form">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button class="btn" type="submit">Restore Estimate</button>
              </form>
            ) : (
              <form method="post" action={`/estimate/${estimate.id}/archive`} class="inline-form">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <button class="btn" type="submit">Archive Estimate</button>
              </form>
            )
          ) : null}
        </div>
      </div>

      {notice ? (
        <div class="card" style={noticeStyle(noticeTone)}>
          {notice}
        </div>
      ) : null}

      <div class="grid grid-4 mobile-card-grid" style="margin-bottom:14px;">
        <div class="card mobile-kpi-card">
          <div class="metric-label">Status</div>
          <div style="margin-top:8px;">
            {estimate.archived_at ? (
              <span class="badge badge-warn">Archived</span>
            ) : (
              <span class={statusBadgeClass(estimate.status)}>{statusLabel(estimate.status)}</span>
            )}
          </div>
        </div>
        <div class="card mobile-kpi-card">
          <div class="metric-label">Base Cost</div>
          <div class="metric-value">${formatMoney(totalBaseCost)}</div>
        </div>
        <div class="card mobile-kpi-card">
          <div class="metric-label">Subtotal</div>
          <div class="metric-value">${formatMoney(estimate.subtotal)}</div>
        </div>
        <div class="card mobile-kpi-card">
          <div class="metric-label">Markup Value</div>
          <div class="metric-value">${formatMoney(grossMarkupValue)}</div>
        </div>
      </div>

      {(canSendEstimate || publicUrl) ? (
        <div class="card" style="margin-bottom:14px;">
          <div class="page-head" style="margin-bottom:12px;">
            <div>
              <h3 style="margin:0;">Customer Approval Delivery</h3>
              <p class="muted" style="margin-top:6px;">
                Send this estimate by email and keep the approval link available for manual copy if needed.
              </p>
            </div>
          </div>

          <div style="display:grid; gap:12px;">
            <div style="display:grid; gap:6px;">
              <div class="small muted">Customer Email</div>
              <div>
                {estimate.customer_email ? (
                  <b>{estimate.customer_email}</b>
                ) : (
                  <span class="muted">No customer email saved yet.</span>
                )}
              </div>
            </div>

            {canSendEstimate ? (
              <form method="post" action={`/estimate/${estimate.id}/send`}>
                <input type="hidden" name="csrf_token" value={csrfToken || ''} />
                <div class="actions" style="justify-content:flex-start; margin-top:0;">
                  <button class="btn btn-primary" type="submit">
                    {estimate.status === 'sent' ? 'Resend Estimate Email' : 'Send Estimate Email'}
                  </button>
                </div>
              </form>
            ) : null}

            {publicUrl ? (
              <div style="display:grid; gap:8px;">
                <div class="small muted">Customer Approval Link</div>
                <div
                  style="border:1px solid #E5EAF2; background:#F8FAFC; border-radius:12px; padding:12px; word-break:break-all;"
                >
                  {publicUrl}
                </div>
                <div class="small muted">
                  This link remains available if you need to copy it manually or resend it outside the system.
                </div>
              </div>
            ) : (
              <div class="small muted">
                Once sent, the approval link will appear here for copying and delivery backup.
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div class="grid" style="grid-template-columns:1.2fr .8fr; gap:14px; align-items:start;">
        <div class="card">
          <h3 style="margin-top:0;">Job Description</h3>
          <div class="muted" style="white-space:pre-wrap;">
            {estimate.scope_of_work || 'No job description entered yet.'}
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Customer</h3>
          <div><b>{estimate.customer_name}</b></div>
          <div class="muted" style="margin-top:6px;">{estimate.customer_email || 'No email on file'}</div>
          <div class="muted">{estimate.customer_phone || 'No phone on file'}</div>
          <div class="muted" style="margin-top:10px;">{estimate.site_address || 'No site address entered'}</div>

          <div style="margin-top:14px; border-top:1px solid #E5EAF2; padding-top:14px;">
            <div class="small muted">Created</div>
            <div>{estimate.created_at?.slice(0, 10) || '—'}</div>
            <div class="small muted" style="margin-top:10px;">Last Updated</div>
            <div>{estimate.updated_at?.slice(0, 10) || '—'}</div>
            {estimate.sent_at ? (
              <>
                <div class="small muted" style="margin-top:10px;">Sent</div>
                <div>{estimate.sent_at.replace('T', ' ').slice(0, 16)}</div>
              </>
            ) : null}
            {estimate.responded_at ? (
              <>
                <div class="small muted" style="margin-top:10px;">Responded</div>
                <div>{estimate.responded_at.replace('T', ' ').slice(0, 16)}</div>
              </>
            ) : null}
            {estimate.expiration_date ? (
              <>
                <div class="small muted" style="margin-top:10px;">Expiration</div>
                <div>{estimate.expiration_date}</div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <h3 style="margin-top:0;">Line Items</h3>
        {estimate.line_items.length ? (
          <div style="display:grid; gap:12px;">
            {estimate.line_items.map((item, index) => (
              <div
                key={item.id}
                style="border:1px solid #E5EAF2; border-radius:14px; padding:14px; background:#FFF;"
              >
                <div style="font-size:12px; color:#64748B; margin-bottom:6px;">
                  Line {index + 1}
                </div>
                <div style="font-weight:700; margin-bottom:10px;">{item.description}</div>
                <div
                  style="display:grid; gap:10px; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));"
                >
                  <div>
                    <div class="small muted">Quantity</div>
                    <div>{Number(item.quantity || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div class="small muted">Unit</div>
                    <div>{item.unit || '—'}</div>
                  </div>
                  <div>
                    <div class="small muted">Base Cost</div>
                    <div>${formatMoney(item.unit_cost)}</div>
                  </div>
                  <div>
                    <div class="small muted">Upcharge</div>
                    <div>{item.apply_upcharge ? `${Number(item.upcharge_percent || 0).toFixed(2)}%` : 'Not applied'}</div>
                  </div>
                  <div>
                    <div class="small muted">Sell Unit Price</div>
                    <div>${formatMoney(item.unit_price)}</div>
                  </div>
                  <div>
                    <div class="small muted">Line Total</div>
                    <div style="font-weight:700;">${formatMoney(item.line_total)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div class="muted">No line items found.</div>
        )}
      </div>

      {(estimate.rejection_reason || estimate.approval_notes || estimate.converted_job_id) ? (
        <div class="grid grid-3 mobile-card-grid" style="margin-top:14px;">
          {estimate.approval_notes ? (
            <div class="card">
              <div class="metric-label">Approval Notes</div>
              <div style="margin-top:8px; white-space:pre-wrap;">{estimate.approval_notes}</div>
            </div>
          ) : null}
          {estimate.rejection_reason ? (
            <div class="card">
              <div class="metric-label">Rejection Reason</div>
              <div style="margin-top:8px; white-space:pre-wrap;">{estimate.rejection_reason}</div>
            </div>
          ) : null}
          {estimate.converted_job_id ? (
            <div class="card">
              <div class="metric-label">Converted Job</div>
              <div style="margin-top:8px;">
                <a class="btn" href={`/job/${estimate.converted_job_id}`}>
                  {estimate.converted_job_name || `Job #${estimate.converted_job_id}`}
                </a>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default EstimateDetailPage;
