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
}

export const SettingsPage: FC<SettingsPageProps> = ({ tenant, csrfToken, error, success }) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Company Settings</h1>
          <p>Manage your workspace branding, invoice defaults, and company details.</p>
        </div>
      </div>

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

            <label>Company Name</label>
            <input name="name" value={tenant.name || ''} required />

            <label>Subdomain</label>
            <input value={tenant.subdomain || ''} disabled />
            <div class="muted" style="font-size:12px; margin-top:6px;">
              Subdomain changes should be handled manually for now.
            </div>

            <label>Logo</label>
            <input type="file" name="logo" accept=".png,.jpg,.jpeg,.webp" />

            {tenant.logo_path ? (
              <div style="margin-top:12px;">
                <img
                  src={tenant.logo_path}
                  alt="Company Logo"
                  style="max-height:80px; border:1px solid #E5EAF2; border-radius:12px; padding:8px; background:white;"
                />
              </div>
            ) : null}
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Company Contact</h3>

            <label>Company Email</label>
            <input name="company_email" value={tenant.company_email || ''} />

            <label>Company Phone</label>
            <input name="company_phone" value={tenant.company_phone || ''} />

            <label>Company Address</label>
            <textarea name="company_address" rows={5}>
              {tenant.company_address || ''}
            </textarea>
          </div>
        </div>

        <div class="grid grid-2" style="margin-top:14px;">
          <div class="card">
            <h3 style="margin-top:0;">Invoice Defaults</h3>

            <label>Invoice Prefix</label>
            <input
              name="invoice_prefix"
              value={tenant.invoice_prefix || ''}
              placeholder="Example: INV"
            />

            <label>Default Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              name="default_tax_rate"
              value={String(tenant.default_tax_rate || 0)}
            />
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Labor Defaults</h3>

            <label>Default Labor Rate</label>
            <input
              type="number"
              step="0.01"
              name="default_labor_rate"
              value={String(tenant.default_labor_rate || 0)}
            />

            <div class="muted" style="margin-top:10px; font-size:12px;">
              This can be used later for faster job costing and default employee setup.
            </div>
          </div>
        </div>

        <div class="actions" style="margin-top:16px;">
          <button class="btn btn-primary" type="submit">Save Settings</button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;