import type { FC } from 'hono/jsx';

interface WebsiteRequestPageProps {
  csrfToken: string;
  error?: string;
  success?: boolean;
  formData?: Record<string, string>;
}

export const WebsiteRequestPage: FC<WebsiteRequestPageProps> = ({
  csrfToken,
  error,
  success,
  formData = {},
}) => {
  return (
    <div>
      <style>{`
        .wr-wrap {
          max-width: 720px;
          margin: 0 auto;
          padding: 40px 24px 80px;
        }
        .wr-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #64748B;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          margin-bottom: 32px;
        }
        .wr-back:hover { color: #1E3A5F; text-decoration: none; }
        .wr-header { margin-bottom: 32px; }
        .wr-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          border-radius: 999px;
          background: #EFF6FF;
          border: 1px solid #DBEAFE;
          color: #1D4ED8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }
        .wr-h1 {
          margin: 0 0 10px;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #0F172A;
        }
        .wr-sub {
          color: #64748B;
          font-size: 16px;
          line-height: 1.75;
          margin: 0;
        }
        .wr-card {
          background: #FFFFFF;
          border: 1px solid #E5EAF2;
          border-radius: 18px;
          padding: 36px 32px;
          box-shadow: 0 4px 24px rgba(15,23,42,0.07);
        }
        .wr-error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 12px;
          padding: 14px 18px;
          color: #B91C1C;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 24px;
        }
        .wr-success {
          background: #F0FDF4;
          border: 1px solid #BBF7D0;
          border-radius: 18px;
          padding: 48px 36px;
          text-align: center;
        }
        .wr-success-icon { font-size: 48px; margin-bottom: 16px; }
        .wr-success h2 {
          margin: 0 0 10px;
          font-size: 26px;
          font-weight: 900;
          color: #14532D;
        }
        .wr-success p {
          color: #166534;
          font-size: 16px;
          line-height: 1.75;
          margin: 0 0 24px;
        }
        .wr-section-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: #1E3A5F;
          margin: 0 0 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #E5EAF2;
        }
        .wr-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .wr-field { margin-bottom: 20px; }
        .wr-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 6px;
        }
        .wr-label span { color: #DC2626; margin-left: 2px; }
        .wr-input, .wr-select, .wr-textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          font-size: 14px;
          color: #0F172A;
          background: #FFFFFF;
          transition: border-color .15s;
          font-family: inherit;
          box-sizing: border-box;
        }
        .wr-input:focus, .wr-select:focus, .wr-textarea:focus {
          outline: none;
          border-color: #1E3A5F;
          box-shadow: 0 0 0 3px rgba(30,58,95,0.08);
        }
        .wr-textarea { min-height: 100px; resize: vertical; }
        .wr-select { cursor: pointer; }
        .wr-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .wr-checkbox-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          color: #374151;
          font-weight: 600;
          transition: border-color .15s, background .15s;
        }
        .wr-checkbox-item:hover { border-color: #1E3A5F; background: #F8FAFC; }
        .wr-checkbox-item input { width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; accent-color: #1E3A5F; }
        .wr-divider { border: none; border-top: 1.5px solid #E5EAF2; margin: 28px 0; }
        .wr-submit {
          width: 100%;
          height: 52px;
          border-radius: 12px;
          background: #F59E0B;
          color: #0F172A;
          font-weight: 800;
          font-size: 16px;
          border: none;
          cursor: pointer;
          transition: filter .15s;
          margin-top: 8px;
        }
        .wr-submit:hover { filter: brightness(1.08); }
        .wr-note {
          text-align: center;
          color: #94A3B8;
          font-size: 13px;
          margin-top: 14px;
          line-height: 1.6;
        }
        @media (max-width: 600px) {
          .wr-card { padding: 24px 18px; }
          .wr-row { grid-template-columns: 1fr; }
          .wr-checkbox-grid { grid-template-columns: 1fr; }
          .wr-h1 { font-size: 26px; }
        }
      `}</style>

      <div class="wr-wrap">
        <a href="/" class="wr-back">← Back to Home</a>

        <div class="wr-header">
          <div class="wr-eyebrow">🌐 Website Development</div>
          <h1 class="wr-h1">Request a Website</h1>
          <p class="wr-sub">
            Fill out the form below and we'll review your project details and get back to you with a custom estimate.
          </p>
        </div>

        {success ? (
          <div class="wr-success">
            <div class="wr-success-icon">✅</div>
            <h2>Request Received!</h2>
            <p>Thanks! Your request has been received. We'll review it and get back to you shortly with an estimate.</p>
            <a href="/" style="display:inline-flex;align-items:center;justify-content:center;height:46px;padding:0 24px;border-radius:10px;background:#1E3A5F;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;">
              Back to Home
            </a>
          </div>
        ) : (
          <div class="wr-card">
            {error && <div class="wr-error">⚠️ {error}</div>}

            <form method="post" action="/website-request">
              <input type="hidden" name="csrf_token" value={csrfToken} />

              {/* Contact Info */}
              <div class="wr-section-label">Contact Information</div>
              <div class="wr-row">
                <div class="wr-field">
                  <label class="wr-label" for="name">Name <span>*</span></label>
                  <input class="wr-input" type="text" id="name" name="name" required value={formData.name ?? ''} placeholder="Your full name" />
                </div>
                <div class="wr-field">
                  <label class="wr-label" for="phone">Phone Number <span>*</span></label>
                  <input class="wr-input" type="tel" id="phone" name="phone" required value={formData.phone ?? ''} placeholder="(555) 000-0000" />
                </div>
              </div>
              <div class="wr-row">
                <div class="wr-field">
                  <label class="wr-label" for="email">Email <span>*</span></label>
                  <input class="wr-input" type="email" id="email" name="email" required value={formData.email ?? ''} placeholder="you@example.com" />
                </div>
                <div class="wr-field">
                  <label class="wr-label" for="org_name">Project / Organization Name <span>*</span></label>
                  <input class="wr-input" type="text" id="org_name" name="org_name" required value={formData.org_name ?? ''} placeholder="Your business or project name" />
                </div>
              </div>

              <hr class="wr-divider" />

              {/* Package */}
              <div class="wr-section-label">Package & Scope</div>
              <div class="wr-row">
                <div class="wr-field">
                  <label class="wr-label" for="base_package">Base Package <span>*</span></label>
                  <select class="wr-select" id="base_package" name="base_package" required>
                    <option value="" disabled selected={!formData.base_package}>Select a package</option>
                    <option value="Starter" selected={formData.base_package === 'Starter'}>Starter</option>
                    <option value="Growth" selected={formData.base_package === 'Growth'}>Growth</option>
                    <option value="Premium" selected={formData.base_package === 'Premium'}>Premium</option>
                  </select>
                </div>
                <div class="wr-field">
                  <label class="wr-label" for="website_size">Website Size <span>*</span></label>
                  <select class="wr-select" id="website_size" name="website_size" required>
                    <option value="" disabled selected={!formData.website_size}>Select a size</option>
                    <option value="Small" selected={formData.website_size === 'Small'}>Small</option>
                    <option value="Medium" selected={formData.website_size === 'Medium'}>Medium</option>
                    <option value="Large" selected={formData.website_size === 'Large'}>Large</option>
                  </select>
                </div>
              </div>
              <div class="wr-field">
                <label class="wr-label" for="design_level">Design Level <span>*</span></label>
                <select class="wr-select" id="design_level" name="design_level" required>
                  <option value="" disabled selected={!formData.design_level}>Select a design level</option>
                  <option value="Basic" selected={formData.design_level === 'Basic'}>Basic</option>
                  <option value="Custom" selected={formData.design_level === 'Custom'}>Custom</option>
                  <option value="Advanced" selected={formData.design_level === 'Advanced'}>Advanced</option>
                </select>
              </div>

              <hr class="wr-divider" />

              {/* Features */}
              <div class="wr-section-label">Features Needed</div>
              <div class="wr-field">
                <div class="wr-checkbox-grid">
                  {[
                    { value: 'Gallery', label: '🖼️ Gallery' },
                    { value: 'Booking', label: '📅 Booking' },
                    { value: 'Payments', label: '💳 Payments' },
                    { value: 'Accounts', label: '👤 User Accounts' },
                  ].map(({ value, label }) => (
                    <label class="wr-checkbox-item">
                      <input type="checkbox" name="features" value={value} checked={formData[`feat_${value}`] === '1'} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <hr class="wr-divider" />

              {/* Add-ons */}
              <div class="wr-section-label">Add-ons</div>
              <div class="wr-field">
                <div class="wr-checkbox-grid">
                  {[
                    { value: 'Logo', label: '🎨 Logo Design' },
                    { value: 'SEO', label: '🔍 SEO Setup' },
                    { value: 'Content', label: '✏️ Content Writing' },
                  ].map(({ value, label }) => (
                    <label class="wr-checkbox-item">
                      <input type="checkbox" name="addons" value={value} checked={formData[`addon_${value}`] === '1'} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <hr class="wr-divider" />

              {/* Notes */}
              <div class="wr-section-label">Additional Details</div>
              <div class="wr-field">
                <label class="wr-label" for="notes">Additional Notes</label>
                <textarea class="wr-textarea" id="notes" name="notes" placeholder="Tell us about your project, timeline, goals, or anything else we should know...">{formData.notes ?? ''}</textarea>
              </div>

              <button type="submit" class="wr-submit">Submit Request →</button>
              <p class="wr-note">No commitment required. We'll review your request and reach out with a custom estimate.</p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
