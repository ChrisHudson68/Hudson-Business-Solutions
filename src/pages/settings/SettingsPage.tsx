import type { FC } from 'hono/jsx';

interface TenantInfo {
  id: number;
  name: string;
  subdomain: string;
  logo_path: string | null;
  invoice_prefix: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  default_tax_rate: number;
  default_labor_rate: number;
}

interface SettingsPageProps {
  tenant: TenantInfo;
  csrfToken: string;
  error?: string;
  success?: string;
  canManageSettings?: boolean;
}

function isFilled(value: string | null | undefined): boolean {
  return String(value || '').trim().length > 0;
}

export const SettingsPage: FC<SettingsPageProps> = ({
  tenant,
  csrfToken,
  error,
  success,
  canManageSettings,
}) => {
  const readOnly = !canManageSettings;

  const setupItems = [
    { label: 'Company name added', done: isFilled(tenant.name) },
    { label: 'Logo uploaded', done: !!tenant.logo_path },
    { label: 'Company email added', done: isFilled(tenant.company_email) },
    { label: 'Company phone added', done: isFilled(tenant.company_phone) },
    { label: 'Company address added', done: isFilled(tenant.company_address) },
    { label: 'Invoice prefix set', done: isFilled(tenant.invoice_prefix) },
  ];

  const completedCount = setupItems.filter((item) => item.done).length;
  const totalCount = setupItems.length;
  const setupComplete = completedCount === totalCount;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Company Settings</h1>
          <p>Manage your workspace branding, invoice defaults, and company details.</p>
        </div>
      </div>

      {!setupComplete ? (
        <div class="card" style="margin-bottom:14px;">
          <div class="card-head">
            <div>
              <b>Complete Your Company Setup</b>
              <div class="muted small" style="margin-top:4px;">
                These details improve invoices, branding, customer communication, and first impressions.
              </div>
            </div>
            <span class="badge">
              {completedCount}/{totalCount} complete
            </span>
          </div>

          <div class="grid grid-2" style="margin-top:14px;">
            <div>
              <div class="list">
                {setupItems.map((item) => (
                  <div
                    class="list-item"
                    style={item.done ? 'background:#F0FDF4; border-color:#BBF7D0;' : ''}
                  >
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span
                        class={item.done ? 'badge badge-good' : 'badge'}
                        style="min-width:32px; justify-content:center;"
                      >
                        {item.done ? '✓' : '○'}
                      </span>
                      <div style="font-weight:800; color:#0F172A;">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div class="card" style="padding:16px; background:#F8FAFC;">
              <h3 style="margin-top:0;">Recommended Next Steps</h3>
              <div class="muted" style="line-height:1.75;">
                Most teams should:
              </div>
              <div class="list" style="margin-top:12px;">
                <div class="list-item">
                  <b>1. Add company contact details</b>
                  <div class="muted small" style="margin-top:4px;">
                    These help your invoices and workspace feel complete and professional.
                  </div>
                </div>
                <div class="list-item">
                  <b>2. Upload your company logo</b>
                  <div class="muted small" style="margin-top:4px;">
                    Branding carries through to the workspace and creates a more polished customer experience.
                  </div>
                </div>
                <div class="list-item">
                  <b>3. Set invoice and labor defaults</b>
                  <div class="muted small" style="margin-top:4px;">
                    Default values reduce repetitive setup and make daily operations faster.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;"
        >
          Your company setup looks complete. Your workspace branding and defaults are in good shape.
        </div>
      )}

      {readOnly ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#BFDBFE; background:#EFF6FF; color:#1D4ED8;"
        >
          You can view workspace settings, but only users with settings management permission can make changes.
        </div>
      ) : null}

      {error ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;"
        >
          {success}
        </div>
      ) : null}

      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="csrf_token" value={csrfToken} />

        <div class="grid grid-2">
          <div class="card">
            <h3 style="margin-top:0;">Branding</h3>
            <div class="muted small" style="margin-bottom:10px;">
              These details shape how your workspace and outward-facing invoice identity appear.
            </div>

            <label>Company Name</label>
            <input name="name" value={tenant.name || ''} required disabled={readOnly} />

            <label>Subdomain</label>
            <input value={tenant.subdomain || ''} disabled />
            <div class="muted small" style="margin-top:6px;">
              Subdomain changes should be handled manually for now.
            </div>

            <label>Logo</label>
            <input type="file" name="logo" accept=".png,.jpg,.jpeg,.webp" disabled={readOnly} />

            {tenant.logo_path ? (
              <div style="margin-top:12px;">
                <img
                  src={tenant.logo_path}
                  alt="Company Logo"
                  style="max-height:80px; border:1px solid #E5EAF2; border-radius:12px; padding:8px; background:white;"
                />
              </div>
            ) : (
              <div class="muted small" style="margin-top:10px;">
                Uploading a logo helps your workspace feel complete and professional.
              </div>
            )}
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Company Contact</h3>
            <div class="muted small" style="margin-bottom:10px;">
              These details are helpful for invoices, internal reference, and customer communication.
            </div>

            <label>Company Email</label>
            <input name="company_email" value={tenant.company_email || ''} disabled={readOnly} />

            <label>Company Phone</label>
            <input name="company_phone" value={tenant.company_phone || ''} disabled={readOnly} />

            <label>Company Address</label>
            <textarea name="company_address" rows={5} disabled={readOnly}>
              {tenant.company_address || ''}
            </textarea>
          </div>
        </div>

        <div class="grid grid-2" style="margin-top:14px;">
          <div class="card">
            <h3 style="margin-top:0;">Invoice Defaults</h3>
            <div class="muted small" style="margin-bottom:10px;">
              Set defaults that make invoice creation faster and more consistent.
            </div>

            <label>Invoice Prefix</label>
            <input
              name="invoice_prefix"
              value={tenant.invoice_prefix || ''}
              placeholder="Example: INV"
              disabled={readOnly}
            />

            <label>Default Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              name="default_tax_rate"
              value={String(tenant.default_tax_rate || 0)}
              disabled={readOnly}
            />
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Labor Defaults</h3>
            <div class="muted small" style="margin-bottom:10px;">
              Default labor settings can reduce repetitive setup and support better job costing.
            </div>

            <label>Default Labor Rate</label>
            <input
              type="number"
              step="0.01"
              name="default_labor_rate"
              value={String(tenant.default_labor_rate || 0)}
              disabled={readOnly}
            />

            <div class="muted small" style="margin-top:10px;">
              This can be used later for faster job costing and default employee setup.
            </div>
          </div>
        </div>

        {!readOnly ? (
          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Save Settings</button>
          </div>
        ) : null}
      </form>
    </div>
  );
};

export default SettingsPage;