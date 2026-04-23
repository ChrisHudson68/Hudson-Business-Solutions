import type { FC } from 'hono/jsx';
import type { EstimateWithLineItems } from '../../db/types.js';

interface PublicEstimatePageProps {
  appName: string;
  appLogo: string;
  companyName: string;
  estimate: EstimateWithLineItems;
  publicUrl: string;
  csrfToken: string;
  notice?: string;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusBadgeClass(status: string): string {
  if (status === 'approved' || status === 'converted') return 'badge';
  if (status === 'rejected' || status === 'expired') return 'badge badge-bad';
  if (status === 'sent' || status === 'ready') return 'badge';
  return 'badge';
}

function statusLabel(status: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const PublicEstimatePage: FC<PublicEstimatePageProps> = ({
  companyName,
  estimate,
  publicUrl,
  csrfToken,
  notice,
}) => {
  const canRespond = estimate.status === 'sent';

  return (
    <div style="display:grid; gap:16px;">
      <div class="page-head">
        <h1>Estimate {estimate.estimate_number}</h1>
        <p>
          Review this estimate from <b>{companyName}</b> and approve or reject it below.
        </p>
      </div>

      {notice ? (
        <div
          class="card"
          style="border-color:#BFDBFE; background:#EFF6FF; color:#1E3A8A;"
        >
          {notice}
        </div>
      ) : null}

      <div
        class="card"
        style="display:grid; gap:14px;"
      >
        <div
          style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));"
        >
          <div>
            <div class="muted" style="text-align:left;">Status</div>
            <div style="margin-top:8px;">
              <span class={statusBadgeClass(estimate.status)}>{statusLabel(estimate.status)}</span>
            </div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Customer</div>
            <div style="margin-top:8px; font-weight:700;">{estimate.customer_name}</div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Total</div>
            <div style="margin-top:8px; font-size:24px; font-weight:800;">${formatMoney(estimate.total)}</div>
          </div>
        </div>

        <div
          style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));"
        >
          <div>
            <div class="muted" style="text-align:left;">Estimate Link</div>
            <div style="margin-top:8px; word-break:break-all;">{publicUrl}</div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Site Address</div>
            <div style="margin-top:8px;">{estimate.site_address || 'Not provided'}</div>
          </div>
        </div>

        <div>
          <div class="muted" style="text-align:left;">Scope of Work</div>
          <div style="margin-top:8px; white-space:pre-wrap;">
            {estimate.scope_of_work || 'No scope of work entered.'}
          </div>
        </div>

        {estimate.expiration_date ? (
          <div>
            <div class="muted" style="text-align:left;">Expiration Date</div>
            <div style="margin-top:8px;">{estimate.expiration_date}</div>
          </div>
        ) : null}
      </div>

      <div class="card">
        <h3 style="margin-top:0;">Line Items</h3>
        <div style="display:grid; gap:12px;">
          {estimate.line_items.length ? (
            estimate.line_items.map((item, index) => (
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
                    <div class="muted" style="text-align:left;">Quantity</div>
                    <div style="margin-top:4px;">{Number(item.quantity || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div class="muted" style="text-align:left;">Unit</div>
                    <div style="margin-top:4px;">{item.unit || '—'}</div>
                  </div>
                  <div>
                    <div class="muted" style="text-align:left;">Unit Price</div>
                    <div style="margin-top:4px;">${formatMoney(item.unit_price)}</div>
                  </div>
                  <div>
                    <div class="muted" style="text-align:left;">Line Total</div>
                    <div style="margin-top:4px; font-weight:700;">${formatMoney(item.line_total)}</div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div class="muted" style="text-align:left;">No line items found.</div>
          )}
        </div>
      </div>

      <div
        class="card"
        style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));"
      >
        <div>
          <div class="muted" style="text-align:left;">Subtotal</div>
          <div style="margin-top:6px; font-size:20px; font-weight:700;">${formatMoney(estimate.subtotal)}</div>
        </div>
        <div>
          <div class="muted" style="text-align:left;">Tax</div>
          <div style="margin-top:6px; font-size:20px; font-weight:700;">${formatMoney(estimate.tax)}</div>
        </div>
        <div>
          <div class="muted" style="text-align:left;">Grand Total</div>
          <div style="margin-top:6px; font-size:24px; font-weight:800;">${formatMoney(estimate.total)}</div>
        </div>
      </div>

      {estimate.approval_notes ? (
        <div class="card">
          <h3 style="margin-top:0;">Approval Notes</h3>
          <div style="white-space:pre-wrap;">{estimate.approval_notes}</div>
        </div>
      ) : null}

      {estimate.rejection_reason ? (
        <div class="card">
          <h3 style="margin-top:0;">Rejection Reason</h3>
          <div style="white-space:pre-wrap;">{estimate.rejection_reason}</div>
        </div>
      ) : null}

      {canRespond ? (
        <div style="display:grid; gap:16px;">
          <div class="card">
            <h3 style="margin-top:0;">Sign &amp; Approve Estimate</h3>
            <p class="muted" style="text-align:left;">
              Draw your signature below and enter your name to approve this estimate and authorize the work to proceed.
            </p>
            <form method="post" action={`/estimate/respond/${estimate.public_token}/approve`} id="approve-form">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="signature_data" id="sig-data-approve" />
              <label for="signer_name_approve">Full Name (printed)</label>
              <input
                type="text"
                id="signer_name_approve"
                name="signer_name"
                placeholder="Your full name"
                required
                autocomplete="name"
              />
              <label>Signature</label>
              <div style="border:2px solid #CBD5E1; border-radius:12px; background:#fff; overflow:hidden; touch-action:none;">
                <canvas id="sig-canvas-approve" style="width:100%; height:160px; display:block; cursor:crosshair;" />
              </div>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <button type="button" id="sig-clear-approve" class="btn" style="font-size:12px; min-height:32px; padding:0 12px;">Clear</button>
                <span id="sig-error-approve" style="color:#991B1B; font-size:13px; align-self:center; display:none;">Please draw your signature.</span>
              </div>
              <label for="approval_notes">Notes (optional)</label>
              <textarea
                id="approval_notes"
                name="approval_notes"
                rows={3}
                placeholder="Add any note for the contractor here"
              />
              <div class="actions" style="justify-content:flex-start; margin-top:16px;">
                <button class="btn btn-primary" type="submit" id="approve-submit-btn">Sign &amp; Approve Estimate</button>
              </div>
            </form>
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Reject Estimate</h3>
            <p class="muted" style="text-align:left;">
              If you are rejecting the estimate, please include a short reason so the team can follow up.
            </p>
            <form method="post" action={`/estimate/respond/${estimate.public_token}/reject`}>
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <label for="rejection_reason">Reason for rejection</label>
              <textarea
                id="rejection_reason"
                name="rejection_reason"
                rows={5}
                placeholder="Please tell us why you are declining this estimate"
                required
              />
              <div class="actions" style="justify-content:flex-start;">
                <button class="btn" type="submit">Reject Estimate</button>
              </div>
            </form>
          </div>

          <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js" />
          <script dangerouslySetInnerHTML={{ __html: `
(function() {
  var canvas = document.getElementById('sig-canvas-approve');
  var ratio = Math.max(window.devicePixelRatio || 1, 1);
  function resizeCanvas() {
    var w = canvas.offsetWidth;
    canvas.width = w * ratio;
    canvas.height = 160 * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    pad.clear();
  }
  var pad = new SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)', penColor: 'rgb(15,23,42)' });
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  document.getElementById('sig-clear-approve').addEventListener('click', function() { pad.clear(); });
  document.getElementById('approve-form').addEventListener('submit', function(e) {
    if (pad.isEmpty()) {
      e.preventDefault();
      document.getElementById('sig-error-approve').style.display = 'inline';
      canvas.style.borderColor = '#EF4444';
      return;
    }
    document.getElementById('sig-data-approve').value = pad.toDataURL('image/png');
  });
})();
          ` }} />
        </div>
      ) : (
        <div class="card">
          <h3 style="margin-top:0;">Response Status</h3>
          {estimate.signed_at ? (
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
              <span style="background:#F0FDF4; border:1px solid #BBF7D0; color:#166534; padding:4px 12px; border-radius:999px; font-size:13px; font-weight:700;">✓ Signed</span>
              {estimate.signer_name ? <span style="font-size:13px; color:#334155;">by <b>{estimate.signer_name}</b></span> : null}
            </div>
          ) : null}
          <p class="muted" style="text-align:left;">
            This estimate has already been responded to and is no longer awaiting customer action.
          </p>
        </div>
      )}
    </div>
  );
};

export default PublicEstimatePage;