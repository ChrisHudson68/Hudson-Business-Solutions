import type { FC } from 'hono/jsx';

type EstimateLineItemFormValue = {
  description: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  upcharge_percent: string;
  apply_upcharge: boolean;
  unit_price: string;
};

interface EstimateFormPageProps {
  mode: 'create' | 'edit';
  estimateId?: number;
  estimateNumber: string;
  csrfToken: string;
  error?: string;
  formData: {
    estimate_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    site_address: string;
    scope_of_work: string;
    proposal_title: string;
    payment_schedule: string;
    custom_terms: string;
    status: string;
    expiration_date: string;
    tax_rate: string;
    default_upcharge_percent: string;
    line_items: EstimateLineItemFormValue[];
    subtotal: string;
    tax: string;
    total: string;
  };
}

const UNIT_SUGGESTIONS = [
  'ea',
  'ft',
  'lf',
  'sq ft',
  'cu ft',
  'cu yd',
  'hr',
  'day',
  'week',
  'month',
  'box',
  'bundle',
  'bag',
  'gal',
  'qt',
  'pt',
  'lb',
  'ton',
  'roll',
  'sheet',
  'set',
  'pair',
  'pcs',
  'carton',
  'tube',
  'can',
  'pallet',
];

export const EstimateFormPage: FC<EstimateFormPageProps> = ({
  mode,
  estimateId,
  estimateNumber,
  csrfToken,
  error,
  formData,
}) => {
  const action = mode === 'create' ? '/estimates/new' : `/estimate/${estimateId}/edit`;
  const title = mode === 'create' ? 'New Estimate' : `Edit ${estimateNumber}`;
  const initialRows = formData.line_items.length
    ? formData.line_items
    : [{ description: '', quantity: '', unit: '', unit_cost: '', upcharge_percent: '', apply_upcharge: false, unit_price: '' }];

  const rowsJson = JSON.stringify(initialRows);

  return (
    <div style="display:grid; gap:14px;">
      <div class="page-head">
        <div>
          <h1>{title}</h1>
          <p class="muted">
            Build a complete estimate with scope of work, line items, upcharge control, and automatic sell pricing.
          </p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={mode === 'create' ? '/estimates' : `/estimate/${estimateId}`}>Back</a>
        </div>
      </div>

      {error ? (
        <div class="card" style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">
          {error}
        </div>
      ) : null}

      <form method="post" action={action} id="estimate-form">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="line_count" id="line_count" value={String(initialRows.length)} />

        <div class="grid" style="grid-template-columns:1.15fr .85fr; gap:14px; align-items:start;">
          <div style="display:grid; gap:14px;">
            <div class="card">
              <h3 style="margin-top:0;">Estimate Information</h3>

              <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                <div>
                  <label for="estimate_number">Estimate Number</label>
                  <input id="estimate_number" name="estimate_number" value={formData.estimate_number || estimateNumber} readonly />
                </div>

                <div>
                  <label for="status">Status</label>
                  <select id="status" name="status">
                    <option value="draft" selected={formData.status === 'draft'}>Draft</option>
                    <option value="ready" selected={formData.status === 'ready'}>Ready</option>
                  </select>
                </div>

                <div>
                  <label for="expiration_date">Expiration Date</label>
                  <input id="expiration_date" type="date" name="expiration_date" value={formData.expiration_date || ''} />
                </div>

                <div>
                  <label for="tax_rate">Tax Rate %</label>
                  <input
                    id="tax_rate"
                    name="tax_rate"
                    value={formData.tax_rate || '0'}
                    inputmode="decimal"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label for="default_upcharge_percent">Default Upcharge %</label>
                  <input
                    id="default_upcharge_percent"
                    name="default_upcharge_percent"
                    value={formData.default_upcharge_percent || ''}
                    inputmode="decimal"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div class="card">
              <h3 style="margin-top:0;">Customer Information</h3>

              <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                <div>
                  <label for="customer_name">Customer Name</label>
                  <input id="customer_name" name="customer_name" value={formData.customer_name} required />
                </div>

                <div>
                  <label for="customer_email">Customer Email</label>
                  <input id="customer_email" name="customer_email" type="email" value={formData.customer_email} />
                </div>

                <div>
                  <label for="customer_phone">Customer Phone</label>
                  <input id="customer_phone" name="customer_phone" value={formData.customer_phone} />
                </div>

                <div style="grid-column:1 / -1;">
                  <label for="site_address">Site Address</label>
                  <input id="site_address" name="site_address" value={formData.site_address} />
                </div>
              </div>
            </div>

            <div class="card">
              <h3 style="margin-top:0;">Scope of Work</h3>
              <label for="scope_of_work">Scope of Work</label>
              <textarea
                id="scope_of_work"
                name="scope_of_work"
                rows={6}
                placeholder="Describe the full scope of work for this estimate"
              >
                {formData.scope_of_work}
              </textarea>
            </div>


            <div class="card">
              <h3 style="margin-top:0;">Proposal Details</h3>
              <div class="grid" style="grid-template-columns:1fr; gap:12px;">
                <div>
                  <label for="proposal_title">Proposal Title</label>
                  <input
                    id="proposal_title"
                    name="proposal_title"
                    value={formData.proposal_title}
                    placeholder="Example: New Construction Home (2-Car Garage Included)"
                  />
                </div>

                <div>
                  <label for="payment_schedule">Payment Schedule</label>
                  <textarea
                    id="payment_schedule"
                    name="payment_schedule"
                    rows={6}
                    placeholder="Use one line per milestone or bullet lines starting with - or *"
                  >
                    {formData.payment_schedule}
                  </textarea>
                  <div class="muted small" style="margin-top:6px;">
                    Example: 50% Deposit: $100,000.00 (Due prior to start)
                  </div>
                </div>

                <div>
                  <label for="custom_terms">Estimate-Specific Terms &amp; Conditions</label>
                  <textarea
                    id="custom_terms"
                    name="custom_terms"
                    rows={8}
                    placeholder="Leave blank to use the company default proposal terms from Settings"
                  >
                    {formData.custom_terms}
                  </textarea>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="page-head" style="margin-bottom:12px;">
                <div>
                  <h3 style="margin:0;">Line Items</h3>
                  <p class="muted" style="margin-top:6px;">
                    Add as many lines as you need. Base cost, upcharge, sell price, and totals recalculate automatically.
                  </p>
                </div>
                <div class="actions">
                  <button type="button" class="btn btn-primary" id="add-line-item-btn">Add Line</button>
                </div>
              </div>

              <datalist id="estimate-unit-suggestions">
                {UNIT_SUGGESTIONS.map((unit) => (
                  <option value={unit} />
                ))}
              </datalist>

              <div id="line-items-container" style="display:grid; gap:12px;" />

              <template id="line-item-template">
                <div class="line-item-card" style="border:1px solid #E5EAF2; border-radius:16px; padding:14px; background:#FFF;">
                  <div class="page-head" style="margin-bottom:10px;">
                    <div>
                      <div class="small muted line-item-label">Line Item</div>
                    </div>
                    <div class="actions">
                      <button type="button" class="btn remove-line-item-btn">Remove</button>
                    </div>
                  </div>

                  <div style="display:grid; gap:12px;">
                    <div>
                      <label>Description</label>
                      <input class="line-description" placeholder="Material, labor, equipment, or service" />
                    </div>

                    <div style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));">
                      <div>
                        <label>Quantity</label>
                        <input class="line-quantity" inputmode="decimal" placeholder="0.00" />
                      </div>

                      <div>
                        <label>Unit</label>
                        <input class="line-unit" list="estimate-unit-suggestions" placeholder="ea, ft, hr, sq ft..." />
                      </div>

                      <div>
                        <label>Base Cost</label>
                        <input class="line-unit-cost" inputmode="decimal" placeholder="0.00" />
                      </div>

                      <div>
                        <label>Upcharge %</label>
                        <input class="line-upcharge-percent" inputmode="decimal" placeholder="0.00" />
                      </div>
                    </div>

                    <div style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); align-items:end;">
                      <div style="display:flex; align-items:center; gap:10px; min-height:44px;">
                        <input class="line-apply-upcharge" type="checkbox" />
                        <label style="margin:0;">Apply upcharge</label>
                      </div>

                      <div>
                        <label>Sell Unit Price</label>
                        <input class="line-unit-price" readonly />
                      </div>

                      <div>
                        <label>Line Total</label>
                        <input class="line-total-display" readonly />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div style="display:grid; gap:14px;">
            <div class="card">
              <h3 style="margin-top:0;">Estimate Summary</h3>

              <div style="display:grid; gap:12px;">
                <div style="display:flex; justify-content:space-between; gap:12px;">
                  <span class="muted">Subtotal</span>
                  <strong id="summary-subtotal">${formData.subtotal || '0.00'}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; gap:12px;">
                  <span class="muted">Tax</span>
                  <strong id="summary-tax">${formData.tax || '0.00'}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; gap:12px; font-size:20px;">
                  <span><b>Total</b></span>
                  <strong id="summary-total">${formData.total || '0.00'}</strong>
                </div>
              </div>

              <input type="hidden" name="subtotal" id="subtotal" value={formData.subtotal || '0.00'} />
              <input type="hidden" name="tax" id="tax" value={formData.tax || '0.00'} />
              <input type="hidden" name="total" id="total" value={formData.total || '0.00'} />
            </div>

            <div class="card">
              <h3 style="margin-top:0;">Estimator Tips</h3>
              <div class="muted" style="display:grid; gap:10px;">
                <div>Enter the true <b>base cost</b>, then choose whether to apply an upcharge.</div>
                <div>New lines can inherit the estimate-level default upcharge percentage.</div>
                <div>Customer-facing views only show the sell price, not your internal cost and markup.</div>
              </div>
            </div>

            <div class="card">
              <div class="actions actions-mobile-stack" style="justify-content:flex-start;">
                <button class="btn btn-primary" type="submit">
                  {mode === 'create' ? 'Create Estimate' : 'Save Estimate'}
                </button>
                <a class="btn" href={mode === 'create' ? '/estimates' : `/estimate/${estimateId}`}>Cancel</a>
              </div>
            </div>
          </div>
        </div>
      </form>

      <script
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  const initialRows = ${rowsJson};
  const container = document.getElementById('line-items-container');
  const template = document.getElementById('line-item-template');
  const addButton = document.getElementById('add-line-item-btn');
  const lineCountInput = document.getElementById('line_count');
  const taxRateInput = document.getElementById('tax_rate');
  const defaultUpchargeInput = document.getElementById('default_upcharge_percent');
  const subtotalInput = document.getElementById('subtotal');
  const taxInput = document.getElementById('tax');
  const totalInput = document.getElementById('total');
  const subtotalLabel = document.getElementById('summary-subtotal');
  const taxLabel = document.getElementById('summary-tax');
  const totalLabel = document.getElementById('summary-total');

  function money(value) {
    const num = Number.parseFloat(String(value || '').replace(/,/g, ''));
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100) / 100;
  }

  function formatMoney(value) {
    return money(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getCards() {
    return Array.from(container.querySelectorAll('.line-item-card'));
  }

  function setNames() {
    getCards().forEach((card, index) => {
      const desc = card.querySelector('.line-description');
      const qty = card.querySelector('.line-quantity');
      const unit = card.querySelector('.line-unit');
      const unitCost = card.querySelector('.line-unit-cost');
      const upchargePercent = card.querySelector('.line-upcharge-percent');
      const applyUpcharge = card.querySelector('.line-apply-upcharge');
      const unitPrice = card.querySelector('.line-unit-price');
      const label = card.querySelector('.line-item-label');

      if (desc) desc.name = 'line_description_' + index;
      if (qty) qty.name = 'line_quantity_' + index;
      if (unit) unit.name = 'line_unit_' + index;
      if (unitCost) unitCost.name = 'line_unit_cost_' + index;
      if (upchargePercent) upchargePercent.name = 'line_upcharge_percent_' + index;
      if (applyUpcharge) {
        applyUpcharge.name = 'line_apply_upcharge_' + index;
        applyUpcharge.value = '1';
      }
      if (unitPrice) unitPrice.name = 'line_unit_price_' + index;
      if (label) label.textContent = 'Line Item ' + (index + 1);
    });

    lineCountInput.value = String(getCards().length);
  }

  function getDefaultUpcharge() {
    return money(defaultUpchargeInput && defaultUpchargeInput.value);
  }

  function updateCardTotal(card) {
    const qty = card.querySelector('.line-quantity');
    const unitCost = card.querySelector('.line-unit-cost');
    const upchargePercent = card.querySelector('.line-upcharge-percent');
    const applyUpcharge = card.querySelector('.line-apply-upcharge');
    const unitPrice = card.querySelector('.line-unit-price');
    const totalDisplay = card.querySelector('.line-total-display');

    const quantity = money(qty && qty.value);
    const cost = money(unitCost && unitCost.value);
    const upcharge = money(upchargePercent && upchargePercent.value);
    const useUpcharge = Boolean(applyUpcharge && applyUpcharge.checked);
    const sellPrice = useUpcharge ? (cost * (1 + (upcharge / 100))) : cost;
    const total = quantity * sellPrice;

    if (unitPrice) unitPrice.value = formatMoney(sellPrice);
    if (totalDisplay) totalDisplay.value = '$' + formatMoney(total);

    return total;
  }

  function updateTotals() {
    const subtotal = getCards().reduce((sum, card) => sum + updateCardTotal(card), 0);
    const taxRate = money(taxRateInput && taxRateInput.value);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    subtotalInput.value = formatMoney(subtotal);
    taxInput.value = formatMoney(tax);
    totalInput.value = formatMoney(total);

    subtotalLabel.textContent = '$' + formatMoney(subtotal);
    taxLabel.textContent = '$' + formatMoney(tax);
    totalLabel.textContent = '$' + formatMoney(total);
  }

  function attachEvents(card) {
    const qty = card.querySelector('.line-quantity');
    const unitCost = card.querySelector('.line-unit-cost');
    const upchargePercent = card.querySelector('.line-upcharge-percent');
    const applyUpcharge = card.querySelector('.line-apply-upcharge');
    const removeBtn = card.querySelector('.remove-line-item-btn');

    [qty, unitCost, upchargePercent].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', updateTotals);
    });

    if (applyUpcharge) {
      applyUpcharge.addEventListener('change', updateTotals);
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        card.remove();
        if (!getCards().length) {
          addLine();
        }
        setNames();
        updateTotals();
      });
    }
  }

  function addLine(row) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.line-item-card');

    if (!card) return;

    const desc = card.querySelector('.line-description');
    const qty = card.querySelector('.line-quantity');
    const unit = card.querySelector('.line-unit');
    const unitCost = card.querySelector('.line-unit-cost');
    const upchargePercent = card.querySelector('.line-upcharge-percent');
    const applyUpcharge = card.querySelector('.line-apply-upcharge');

    const inheritedUpcharge = getDefaultUpcharge();

    if (desc) desc.value = row && row.description ? row.description : '';
    if (qty) qty.value = row && row.quantity ? row.quantity : '';
    if (unit) unit.value = row && row.unit ? row.unit : '';
    if (unitCost) unitCost.value = row && row.unit_cost ? row.unit_cost : '';
    if (upchargePercent) {
      upchargePercent.value = row && row.upcharge_percent !== undefined && row.upcharge_percent !== ''
        ? row.upcharge_percent
        : (inheritedUpcharge > 0 ? String(inheritedUpcharge) : '');
    }
    if (applyUpcharge) {
      applyUpcharge.checked = row && typeof row.apply_upcharge === 'boolean'
        ? row.apply_upcharge
        : inheritedUpcharge > 0;
    }

    container.appendChild(card);
    attachEvents(card);
    setNames();
    updateTotals();
  }

  addButton.addEventListener('click', function () {
    addLine({ description: '', quantity: '', unit: '', unit_cost: '', upcharge_percent: '', apply_upcharge: false, unit_price: '' });
  });

  if (taxRateInput) {
    taxRateInput.addEventListener('input', updateTotals);
  }

  if (Array.isArray(initialRows) && initialRows.length) {
    initialRows.forEach(addLine);
  } else {
    addLine({ description: '', quantity: '', unit: '', unit_cost: '', upcharge_percent: '', apply_upcharge: false, unit_price: '' });
  }

  setNames();
  updateTotals();
})();
          `,
        }}
      />
    </div>
  );
};

export default EstimateFormPage;
