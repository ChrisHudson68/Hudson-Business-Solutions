import type { FC } from 'hono/jsx';

interface PublicInvoicePageProps {
  companyName: string;
  invoice: {
    id: number;
    invoice_number: string;
    date_issued: string;
    due_date: string;
    amount: number;
    notes: string | null;
    status: string;
    job_name: string;
    client_name: string | null;
    public_token: string;
    signature_data: string | null;
    signer_name: string | null;
    signed_at: string | null;
  };
  csrfToken: string;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const PublicInvoicePage: FC<PublicInvoicePageProps> = ({
  companyName,
  invoice,
  csrfToken,
}) => {
  const alreadySigned = !!invoice.signed_at;

  return (
    <div style="display:grid; gap:16px;">
      <div class="page-head">
        <h1>Invoice {invoice.invoice_number}</h1>
        <p>
          Review this invoice from <b>{companyName}</b>
          {alreadySigned ? ' — already signed below.' : ' and sign to acknowledge receipt.'}
        </p>
      </div>

      <div class="card" style="display:grid; gap:14px;">
        <div style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));">
          <div>
            <div class="muted" style="text-align:left;">Invoice #</div>
            <div style="margin-top:6px; font-weight:700;">{invoice.invoice_number}</div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Job</div>
            <div style="margin-top:6px; font-weight:700;">{invoice.job_name}</div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Date Issued</div>
            <div style="margin-top:6px;">{invoice.date_issued}</div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Due Date</div>
            <div style="margin-top:6px;">{invoice.due_date}</div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Amount Due</div>
            <div style="margin-top:6px; font-size:24px; font-weight:900;">${formatMoney(invoice.amount)}</div>
          </div>
        </div>

        {invoice.notes ? (
          <div>
            <div class="muted" style="text-align:left;">Notes</div>
            <div style="margin-top:6px; white-space:pre-wrap; font-size:14px;">{invoice.notes}</div>
          </div>
        ) : null}
      </div>

      {alreadySigned ? (
        <div class="card" style="border-color:#BBF7D0; background:#F0FDF4;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="background:#166534; color:#fff; padding:5px 14px; border-radius:999px; font-size:13px; font-weight:700;">✓ Signed</span>
            {invoice.signer_name ? (
              <span style="font-size:14px; color:#166534; font-weight:600;">by {invoice.signer_name}</span>
            ) : null}
            {invoice.signed_at ? (
              <span style="font-size:13px; color:#16a34a;">
                on {new Date(invoice.signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            ) : null}
          </div>
          {invoice.signature_data ? (
            <div style="margin-top:14px; border:1px solid #BBF7D0; border-radius:8px; overflow:hidden; display:inline-block; background:#fff;">
              <img src={invoice.signature_data} alt="Customer Signature" style="max-width:300px; height:80px; object-fit:contain; display:block;" />
            </div>
          ) : null}
          <p class="muted" style="text-align:left; margin-top:12px; margin-bottom:0; color:#166534;">
            Your signature has been recorded. Thank you!
          </p>
        </div>
      ) : (
        <div class="card">
          <h3 style="margin-top:0;">Sign &amp; Acknowledge</h3>
          <p class="muted" style="text-align:left;">
            Draw your signature below to acknowledge receipt of this invoice and confirm the work was completed.
          </p>
          <form method="post" action={`/invoice/sign/${invoice.public_token}`} id="sign-form">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="signature_data" id="sig-data" />
            <label for="signer_name">Full Name (printed)</label>
            <input
              type="text"
              id="signer_name"
              name="signer_name"
              placeholder="Your full name"
              required
              autocomplete="name"
            />
            <label>Signature</label>
            <div style="border:2px solid #CBD5E1; border-radius:12px; background:#fff; overflow:hidden; touch-action:none;">
              <canvas id="sig-canvas" style="width:100%; height:160px; display:block; cursor:crosshair;" />
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button type="button" id="sig-clear" class="btn" style="font-size:12px; min-height:32px; padding:0 12px;">Clear</button>
              <span id="sig-error" style="color:#991B1B; font-size:13px; align-self:center; display:none;">Please draw your signature.</span>
            </div>
            <div class="actions" style="justify-content:flex-start; margin-top:16px;">
              <button class="btn btn-primary" type="submit">Sign &amp; Acknowledge Invoice</button>
            </div>
          </form>

          <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js" />
          <script dangerouslySetInnerHTML={{ __html: `
(function() {
  var canvas = document.getElementById('sig-canvas');
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
  document.getElementById('sig-clear').addEventListener('click', function() { pad.clear(); });
  document.getElementById('sign-form').addEventListener('submit', function(e) {
    if (pad.isEmpty()) {
      e.preventDefault();
      document.getElementById('sig-error').style.display = 'inline';
      canvas.style.borderColor = '#EF4444';
      return;
    }
    document.getElementById('sig-data').value = pad.toDataURL('image/png');
  });
})();
          ` }} />
        </div>
      )}
    </div>
  );
};

export default PublicInvoicePage;
