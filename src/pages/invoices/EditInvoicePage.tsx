import type { FC } from 'hono/jsx';

type Job = {
  id: number;
  job_name: string;
  client_name: string | null;
  job_code?: string | null;
};

type InvoiceRecord = {
  id: number;
  archived_at?: string | null;
  attachment_filename?: string | null;
};

type InvoiceLineFormValue = {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
};

type EditInvoiceFormValues = {
  job_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  terms_text: string;
  public_notes: string;
  internal_notes: string;
  discount_type: 'none' | 'percent' | 'amount';
  discount_value: string;
  tax_rate: string;
  line_items: InvoiceLineFormValue[];
};

interface EditInvoicePageProps {
  invoice: InvoiceRecord;
  jobs: Job[];
  csrfToken: string;
  error?: string;
  formValues: EditInvoiceFormValues;
}

const UNIT_SUGGESTIONS = ['ea', 'hr', 'day', 'week', 'ft', 'lf', 'sq ft', 'lot', 'set', 'pcs', 'box', 'gal'];

function invoiceEditorScript(rowsJson: string) {
  return `
(function () {
  const initialRows = ${rowsJson};
  const container = document.getElementById('invoice-line-items-container');
  const template = document.getElementById('invoice-line-item-template');
  const addButton = document.getElementById('invoice-add-line-item-btn');
  const lineCountInput = document.getElementById('line_count');
  const discountTypeInput = document.getElementById('discount_type');
  const discountValueInput = document.getElementById('discount_value');
  const taxRateInput = document.getElementById('tax_rate');
  const subtotalInput = document.getElementById('subtotal_preview');
  const discountInput = document.getElementById('discount_preview');
  const taxInput = document.getElementById('tax_preview');
  const totalInput = document.getElementById('total_preview');

  function money(value) {
    const num = Number.parseFloat(String(value || '').replace(/,/g, ''));
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100) / 100;
  }

  function formatMoney(value) {
    return money(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function cards() {
    return Array.from(container.querySelectorAll('.invoice-line-item-card'));
  }

  function setNames() {
    cards().forEach((card, index) => {
      const desc = card.querySelector('.line-description');
      const qty = card.querySelector('.line-quantity');
      const unit = card.querySelector('.line-unit');
      const unitPrice = card.querySelector('.line-unit-price');
      const total = card.querySelector('.line-total-display');
      const label = card.querySelector('.line-item-label');
      if (desc) desc.name = 'line_description_' + index;
      if (qty) qty.name = 'line_quantity_' + index;
      if (unit) unit.name = 'line_unit_' + index;
      if (unitPrice) unitPrice.name = 'line_unit_price_' + index;
      if (label) label.textContent = 'Line Item ' + (index + 1);
      if (total) total.name = 'line_total_display_' + index;
    });
    lineCountInput.value = String(cards().length);
  }

  function lineTotal(card) {
    const qty = card.querySelector('.line-quantity');
    const unitPrice = card.querySelector('.line-unit-price');
    const totalDisplay = card.querySelector('.line-total-display');
    const total = money(qty && qty.value) * money(unitPrice && unitPrice.value);
    if (totalDisplay) totalDisplay.value = '$' + formatMoney(total);
    return total;
  }

  function updateTotals() {
    const subtotal = cards().reduce((sum, card) => sum + lineTotal(card), 0);
    const discountType = String(discountTypeInput && discountTypeInput.value || 'none');
    const discountValue = money(discountValueInput && discountValueInput.value);
    const taxRate = money(taxRateInput && taxRateInput.value);
    let discountAmount = 0;
    if (discountType === 'percent') discountAmount = subtotal * (discountValue / 100);
    else if (discountType === 'amount') discountAmount = Math.min(discountValue, subtotal);
    const taxable = Math.max(subtotal - discountAmount, 0);
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax;
    subtotalInput.textContent = '$' + formatMoney(subtotal);
    discountInput.textContent = '$' + formatMoney(discountAmount);
    taxInput.textContent = '$' + formatMoney(tax);
    totalInput.textContent = '$' + formatMoney(total);
  }

  function attachEvents(card) {
    ['.line-description', '.line-quantity', '.line-unit', '.line-unit-price'].forEach((selector) => {
      const el = card.querySelector(selector);
      if (el) el.addEventListener('input', updateTotals);
    });
    const removeBtn = card.querySelector('.remove-line-item-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        card.remove();
        if (!cards().length) addLine();
        setNames();
        updateTotals();
      });
    }
  }

  function addLine(row) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.invoice-line-item-card');
    if (!card) return;
    const desc = card.querySelector('.line-description');
    const qty = card.querySelector('.line-quantity');
    const unit = card.querySelector('.line-unit');
    const unitPrice = card.querySelector('.line-unit-price');
    if (desc) desc.value = row && row.description ? row.description : '';
    if (qty) qty.value = row && row.quantity ? row.quantity : '';
    if (unit) unit.value = row && row.unit ? row.unit : '';
    if (unitPrice) unitPrice.value = row && row.unit_price ? row.unit_price : '';
    container.appendChild(fragment);
    const lastCard = cards()[cards().length - 1];
    if (lastCard) attachEvents(lastCard);
    setNames();
    updateTotals();
  }

  if (addButton) addButton.addEventListener('click', function () { addLine(); });
  if (discountTypeInput) discountTypeInput.addEventListener('change', updateTotals);
  if (discountValueInput) discountValueInput.addEventListener('input', updateTotals);
  if (taxRateInput) taxRateInput.addEventListener('input', updateTotals);

  (initialRows && initialRows.length ? initialRows : [{ description: '', quantity: '', unit: '', unit_price: '' }]).forEach(addLine);
})();
`;
}

export const EditInvoicePage: FC<EditInvoicePageProps> = ({ invoice, jobs, csrfToken, error, formValues }) => {
  const rowsJson = JSON.stringify(formValues.line_items.length ? formValues.line_items : [{ description: '', quantity: '', unit: '', unit_price: '' }]);
  const selectedJobId = formValues.job_id || '';

  return (
    <div style="display:grid; gap:14px;">
      <div class="page-head">
        <div>
          <h1>Edit Invoice {formValues.invoice_number || `#${invoice.id}`}</h1>
          <p class="muted">Update the draft invoice layout, customer details, line items, and PDF-ready totals.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={`/invoice/${invoice.id}`}>Back</a>
        </div>
      </div>

      {error ? <div class="card" style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">{error}</div> : null}

      {invoice.archived_at ? (
        <div class="card" style="border-color:#FDE68A; background:#FFFBEB; color:#92400E;">
          This invoice is archived. Restore it before making changes.
        </div>
      ) : null}

      <form method="post" enctype="multipart/form-data" id="invoice-form">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="line_count" id="line_count" value={String(formValues.line_items.length || 1)} />

        <div class="grid" style="grid-template-columns:1.15fr .85fr; gap:14px; align-items:start;">
          <div style="display:grid; gap:14px;">
            <div class="card">
              <h3 style="margin-top:0;">Invoice Information</h3>
              <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                <div>
                  <label for="job_id">Job</label>
                  <select id="job_id" name="job_id" required>
                    <option value="">Select a job</option>
                    {jobs.map((job) => (
                      <option value={String(job.id)} selected={selectedJobId === String(job.id)}>
                        {job.job_name}{job.client_name ? ` — ${job.client_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label for="invoice_number">Invoice Number</label>
                  <input id="invoice_number" name="invoice_number" value={formValues.invoice_number} required />
                </div>
                <div>
                  <label for="issue_date">Issue Date</label>
                  <input id="issue_date" type="date" name="issue_date" value={formValues.issue_date} required />
                </div>
                <div>
                  <label for="due_date">Due Date</label>
                  <input id="due_date" type="date" name="due_date" value={formValues.due_date} required />
                </div>
              </div>
            </div>

            <div class="card">
              <h3 style="margin-top:0;">Bill To</h3>
              <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                <div>
                  <label for="customer_name">Customer Name</label>
                  <input id="customer_name" name="customer_name" value={formValues.customer_name} required />
                </div>
                <div>
                  <label for="customer_email">Customer Email</label>
                  <input id="customer_email" type="email" name="customer_email" value={formValues.customer_email} />
                </div>
                <div>
                  <label for="customer_phone">Customer Phone</label>
                  <input id="customer_phone" name="customer_phone" value={formValues.customer_phone} />
                </div>
                <div style="grid-column:1 / -1;">
                  <label for="customer_address">Customer Address</label>
                  <textarea id="customer_address" name="customer_address" rows={3}>{formValues.customer_address}</textarea>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="page-head" style="margin-bottom:12px;">
                <div>
                  <h3 style="margin:0;">Line Items</h3>
                  <p class="muted" style="margin-top:6px;">These rows are what will be rendered in the invoice PDF.</p>
                </div>
                <div class="actions">
                  <button type="button" class="btn btn-primary" id="invoice-add-line-item-btn">Add Line</button>
                </div>
              </div>

              <datalist id="invoice-unit-suggestions">
                {UNIT_SUGGESTIONS.map((unit) => <option value={unit} />)}
              </datalist>

              <div id="invoice-line-items-container" style="display:grid; gap:12px;" />

              <template id="invoice-line-item-template">
                <div class="invoice-line-item-card" style="border:1px solid #E5EAF2; border-radius:16px; padding:14px; background:#FFF;">
                  <div class="page-head" style="margin-bottom:10px;">
                    <div><div class="small muted line-item-label">Line Item</div></div>
                    <div class="actions"><button type="button" class="btn remove-line-item-btn">Remove</button></div>
                  </div>
                  <div style="display:grid; gap:12px;">
                    <div>
                      <label>Description</label>
                      <input class="line-description" placeholder="Labor, material, service, or milestone" />
                    </div>
                    <div style="display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); align-items:end;">
                      <div>
                        <label>Quantity</label>
                        <input class="line-quantity" inputmode="decimal" placeholder="1.00" />
                      </div>
                      <div>
                        <label>Unit</label>
                        <input class="line-unit" list="invoice-unit-suggestions" placeholder="ea, hr, lot..." />
                      </div>
                      <div>
                        <label>Unit Price</label>
                        <input class="line-unit-price" inputmode="decimal" placeholder="0.00" />
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

            <div class="card">
              <h3 style="margin-top:0;">Terms &amp; Notes</h3>
              <div class="grid" style="grid-template-columns:1fr; gap:12px;">
                <div>
                  <label for="terms_text">Terms</label>
                  <textarea id="terms_text" name="terms_text" rows={5}>{formValues.terms_text}</textarea>
                </div>
                <div>
                  <label for="public_notes">Customer Notes</label>
                  <textarea id="public_notes" name="public_notes" rows={4}>{formValues.public_notes}</textarea>
                </div>
                <div>
                  <label for="internal_notes">Internal Notes</label>
                  <textarea id="internal_notes" name="internal_notes" rows={3}>{formValues.internal_notes}</textarea>
                </div>
                <div>
                  <label for="attachment">Replace Attachment</label>
                  <input id="attachment" type="file" name="attachment" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" />
                </div>
                {invoice.attachment_filename ? (
                  <div class="actions actions-mobile-stack">
                    <a class="btn" href={`/invoice-attachments/${invoice.id}`} target="_blank" rel="noreferrer">View Current Attachment</a>
                    <form method="post" action={`/delete_invoice_attachment/${invoice.id}`} class="inline-form" onsubmit="return confirm('Remove this attachment from the invoice?');">
                      <input type="hidden" name="csrf_token" value={csrfToken} />
                      <button class="btn" type="submit">Remove Attachment</button>
                    </form>
                  </div>
                ) : (
                  <div class="muted">No attachment is currently attached.</div>
                )}
              </div>
            </div>
          </div>

          <div style="display:grid; gap:14px;">
            <div class="card">
              <h3 style="margin-top:0;">Totals</h3>
              <div class="grid" style="grid-template-columns:1fr; gap:12px;">
                <div>
                  <label for="discount_type">Discount Type</label>
                  <select id="discount_type" name="discount_type">
                    <option value="none" selected={formValues.discount_type === 'none'}>No discount</option>
                    <option value="percent" selected={formValues.discount_type === 'percent'}>Percent</option>
                    <option value="amount" selected={formValues.discount_type === 'amount'}>Fixed amount</option>
                  </select>
                </div>
                <div>
                  <label for="discount_value">Discount Value</label>
                  <input id="discount_value" name="discount_value" value={formValues.discount_value} inputmode="decimal" placeholder="0.00" />
                </div>
                <div>
                  <label for="tax_rate">Tax Rate %</label>
                  <input id="tax_rate" name="tax_rate" value={formValues.tax_rate} inputmode="decimal" placeholder="0.00" />
                </div>
              </div>
              <div style="display:grid; gap:10px; margin-top:16px;">
                <div style="display:flex; justify-content:space-between; gap:12px;"><span class="muted">Subtotal</span><strong id="subtotal_preview">$0.00</strong></div>
                <div style="display:flex; justify-content:space-between; gap:12px;"><span class="muted">Discount</span><strong id="discount_preview">$0.00</strong></div>
                <div style="display:flex; justify-content:space-between; gap:12px;"><span class="muted">Tax</span><strong id="tax_preview">$0.00</strong></div>
                <div style="display:flex; justify-content:space-between; gap:12px; font-size:22px;"><span><b>Total</b></span><strong id="total_preview">$0.00</strong></div>
              </div>
            </div>

            <div class="card">
              <h3 style="margin-top:0;">Draft rules</h3>
              <div class="muted" style="display:grid; gap:10px;">
                <div>This editor is intended for draft-stage invoice updates before a later finalize/send phase.</div>
                <div>Payments, archived state, and future lock behavior remain protected outside this editor.</div>
              </div>
            </div>

            {!invoice.archived_at ? (
              <div class="card">
                <div class="actions actions-mobile-stack" style="justify-content:flex-start;">
                  <button class="btn btn-primary" type="submit">Save Draft Invoice</button>
                  <a class="btn" href={`/invoice/${invoice.id}`}>Cancel</a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </form>

      <script dangerouslySetInnerHTML={{ __html: invoiceEditorScript(rowsJson) }} />
    </div>
  );
};

export default EditInvoicePage;
