import type { FC } from 'hono/jsx';

interface PublicPaymentPageProps {
  companyName: string;
  invoice: {
    id: number;
    invoice_number: string;
    date_issued: string;
    due_date: string;
    amount: number;
    notes: string | null;
    job_name: string | null;
    client_name: string | null;
    customer_name: string | null;
    public_token: string;
  };
  amountDue: number;
  totalPaid: number;
  stripePublishableKey: string;
  csrfToken: string;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const PublicPaymentPage: FC<PublicPaymentPageProps> = ({
  companyName,
  invoice,
  amountDue,
  totalPaid,
  stripePublishableKey,
  csrfToken,
}) => {
  const displayName = invoice.customer_name || invoice.client_name || null;
  const jobLabel = invoice.job_name || null;
  const alreadyPaid = amountDue <= 0;

  const clientScript = `
(function() {
  var TOKEN = ${JSON.stringify(invoice.public_token)};
  var PK = ${JSON.stringify(stripePublishableKey)};
  var AMOUNT_LABEL = ${JSON.stringify('$' + formatMoney(amountDue))};
  var CSRF = ${JSON.stringify(csrfToken)};

  function show(id) {
    ['loading-section','payment-section','success-section','error-section'].forEach(function(s) {
      var el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? '' : 'none';
    });
  }

  function showError(msg) {
    var el = document.getElementById('error-message');
    if (el) el.textContent = msg;
    show('error-section');
  }

  var params = new URLSearchParams(window.location.search);
  var piClientSecret = params.get('payment_intent_client_secret');
  var redirectStatus = params.get('redirect_status');

  if (piClientSecret) {
    if (redirectStatus === 'succeeded') {
      show('success-section');
    } else {
      showError('Payment was not completed. Please try again or contact your contractor.');
      show('error-section');
    }
    return;
  }

  var stripe = Stripe(PK);

  fetch('/invoice/pay/' + TOKEN + '/intent', {
    method: 'POST',
    headers: { 'X-CSRF-Token': CSRF }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.alreadyPaid) {
      show('success-section');
      return;
    }
    if (data.error) {
      showError(data.error);
      return;
    }

    var elements = stripe.elements({
      clientSecret: data.clientSecret,
      appearance: { theme: 'stripe', variables: { colorPrimary: '#1E3A5F', borderRadius: '12px' } }
    });

    var paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');
    show('payment-section');

    var form = document.getElementById('payment-form');
    var btn = document.getElementById('pay-button');
    var msgEl = document.getElementById('payment-message');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Processing…';
      if (msgEl) msgEl.style.display = 'none';

      var returnUrl = window.location.origin + window.location.pathname;

      stripe.confirmPayment({
        elements: elements,
        confirmParams: { return_url: returnUrl }
      }).then(function(result) {
        if (result.error) {
          btn.disabled = false;
          btn.textContent = 'Pay ' + AMOUNT_LABEL;
          if (msgEl) {
            msgEl.textContent = result.error.message || 'Payment failed. Please try again.';
            msgEl.style.display = '';
          }
        }
      });
    });
  })
  .catch(function() {
    showError('Failed to load the payment form. Please refresh and try again.');
  });
})();
`;

  return (
    <div style="display:grid; gap:16px;">
      <div class="page-head">
        <h1>Invoice {invoice.invoice_number}</h1>
        <p>
          {displayName ? `Hello, ${displayName} — ` : ''}
          Review and pay your invoice from <b>{companyName}</b>.
        </p>
      </div>

      {/* Invoice summary */}
      <div class="card">
        <div style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));">
          <div>
            <div class="muted" style="text-align:left;">Invoice #</div>
            <div style="margin-top:6px; font-weight:700;">{invoice.invoice_number}</div>
          </div>
          {jobLabel ? (
            <div>
              <div class="muted" style="text-align:left;">Job</div>
              <div style="margin-top:6px; font-weight:700;">{jobLabel}</div>
            </div>
          ) : null}
          <div>
            <div class="muted" style="text-align:left;">Date Issued</div>
            <div style="margin-top:6px;">{invoice.date_issued}</div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Due Date</div>
            <div style="margin-top:6px;">{invoice.due_date}</div>
          </div>
          <div>
            <div class="muted" style="text-align:left;">Invoice Total</div>
            <div style="margin-top:6px; font-weight:700;">${formatMoney(invoice.amount)}</div>
          </div>
          {totalPaid > 0 ? (
            <div>
              <div class="muted" style="text-align:left;">Already Paid</div>
              <div style="margin-top:6px; font-weight:700; color:#166534;">${formatMoney(totalPaid)}</div>
            </div>
          ) : null}
          <div>
            <div class="muted" style="text-align:left;">Amount Due</div>
            <div style={`margin-top:6px; font-size:26px; font-weight:900; color:${alreadyPaid ? '#166534' : '#1E3A5F'};`}>
              ${formatMoney(amountDue)}
            </div>
          </div>
        </div>

        {invoice.notes ? (
          <div style="margin-top:16px; padding-top:16px; border-top:1px solid #E5EAF2;">
            <div class="muted" style="text-align:left;">Notes</div>
            <div style="margin-top:6px; white-space:pre-wrap; font-size:14px; line-height:1.6;">{invoice.notes}</div>
          </div>
        ) : null}
      </div>

      {alreadyPaid ? (
        <div class="card" style="border-color:#BBF7D0; background:#F0FDF4; color:#166534;">
          <div style="font-weight:700; font-size:16px; margin-bottom:6px;">Invoice Paid</div>
          <div>This invoice has been paid in full. Thank you!</div>
        </div>
      ) : (
        <>
          {/* Loading state */}
          <div id="loading-section" class="card" style="text-align:center; color:#64748B; padding:32px;">
            <div>Loading payment form&hellip;</div>
          </div>

          {/* Payment form — hidden until JS mounts Stripe */}
          <div id="payment-section" style="display:none;" class="card">
            <h3 style="margin-top:0;">Pay Securely</h3>
            <form id="payment-form">
              <div id="payment-element" style="margin-bottom:16px;" />
              <div
                id="payment-message"
                style="display:none; margin-bottom:12px; padding:10px 14px; border-radius:10px; background:#FEF2F2; border:1px solid #FECACA; color:#991B1B; font-size:14px;"
              />
              <div class="actions" style="justify-content:flex-start;">
                <button id="pay-button" class="btn btn-primary" type="submit" style="min-width:160px;">
                  Pay ${formatMoney(amountDue)}
                </button>
              </div>
            </form>
            <div style="margin-top:14px; display:flex; align-items:center; gap:6px; color:#94A3B8; font-size:12px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Payments are processed securely by Stripe.
            </div>
          </div>

          {/* Success state */}
          <div id="success-section" style="display:none; border-color:#BBF7D0; background:#F0FDF4; color:#166534;" class="card">
            <div style="font-weight:700; font-size:16px; margin-bottom:6px;">Payment Received</div>
            <div>Thank you! Your payment has been processed successfully. {companyName} has been notified.</div>
          </div>

          {/* Error state */}
          <div id="error-section" style="display:none; border-color:#FECACA; background:#FEF2F2; color:#991B1B;" class="card">
            <div style="font-weight:700; font-size:16px; margin-bottom:6px;">Payment Unavailable</div>
            <div id="error-message">Unable to load the payment form. Please try again or contact your contractor.</div>
          </div>

          <script src="https://js.stripe.com/v3/" />
          <script dangerouslySetInnerHTML={{ __html: clientScript }} />
        </>
      )}
    </div>
  );
};

export default PublicPaymentPage;
