import type { FC } from 'hono/jsx';

interface SignupPageProps {
  error?: string;
  formData?: {
    company_name?: string;
    subdomain?: string;
    admin_name?: string;
    admin_email?: string;
    invite_code?: string;
  };
  csrfToken: string;
  inviteOnly?: boolean;
}

export const SignupPage: FC<SignupPageProps> = ({
  error,
  formData,
  csrfToken,
  inviteOnly,
}) => {
  return (
    <div>
      <style>{`
        .su-wrap{
          display:flex;
          justify-content:center;
          padding:8px 0 24px;
        }

        .su-card{
          width:min(540px, 100%);
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:20px;
          box-shadow:0 16px 40px rgba(15,23,42,0.09);
          overflow:hidden;
        }

        .su-card-head{
          background:linear-gradient(135deg, #0F1F35 0%, #1E3A5F 100%);
          padding:28px 28px 24px;
        }

        .su-card-head-badge{
          display:inline-flex;
          align-items:center;
          gap:7px;
          padding:6px 11px;
          border-radius:999px;
          background:rgba(245,158,11,0.18);
          border:1px solid rgba(245,158,11,0.30);
          color:#FCD34D;
          font-size:12px;
          font-weight:800;
          letter-spacing:0.04em;
          text-transform:uppercase;
          margin-bottom:14px;
        }

        .su-card-head h2{
          margin:0 0 6px;
          font-size:22px;
          font-weight:800;
          color:#FFFFFF;
          letter-spacing:-0.02em;
          line-height:1.2;
        }

        .su-card-head p{
          margin:0;
          font-size:14px;
          color:rgba(255,255,255,0.60);
          line-height:1.6;
        }

        .su-pricing{
          display:flex;
          align-items:baseline;
          gap:4px;
          margin-top:14px;
        }

        .su-pricing-amount{
          font-size:32px;
          font-weight:900;
          color:#F59E0B;
          letter-spacing:-0.03em;
          line-height:1;
        }

        .su-pricing-sub{
          font-size:13px;
          color:rgba(255,255,255,0.55);
          font-weight:600;
        }

        .su-card-body{
          padding:24px 28px 28px;
        }

        .su-error{
          margin-bottom:16px;
          border:1px solid #FECACA;
          background:#FEF2F2;
          color:#991B1B;
          border-radius:12px;
          padding:11px 14px;
          line-height:1.6;
          font-size:14px;
          font-weight:600;
          display:flex;
          gap:8px;
          align-items:flex-start;
        }

        .su-row{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:14px;
        }

        .su-field{
          margin-bottom:14px;
        }

        .su-label{
          display:block;
          font-size:13px;
          font-weight:700;
          color:#334155;
          margin-bottom:6px;
        }

        .su-input{
          width:100%;
          padding:11px 14px;
          border:1.5px solid #E5EAF2;
          border-radius:12px;
          font-size:15px;
          background:#FAFAFA;
          outline:none;
          color:#0F172A;
          transition:border-color .15s, box-shadow .15s, background .15s;
        }

        .su-input:focus{
          border-color:#1E3A5F;
          background:#FFFFFF;
          box-shadow:0 0 0 4px rgba(30,58,95,0.10);
        }

        .su-hint{
          margin-top:6px;
          font-size:12px;
          color:#94A3B8;
          line-height:1.5;
        }

        .su-divider{
          height:1px;
          background:#F1F5F9;
          margin:6px 0 18px;
        }

        .su-section-label{
          font-size:11px;
          font-weight:800;
          letter-spacing:0.08em;
          text-transform:uppercase;
          color:#94A3B8;
          margin-bottom:14px;
        }

        .su-submit{
          width:100%;
          margin-top:6px;
          padding:13px 20px;
          background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          color:#0F172A;
          font-size:15px;
          font-weight:800;
          border:none;
          border-radius:12px;
          cursor:pointer;
          letter-spacing:0.01em;
          transition:filter .15s, transform .1s;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
        }

        .su-submit:hover{
          filter:brightness(1.06);
        }

        .su-submit:active{
          transform:scale(0.99);
        }

        .su-note{
          margin-top:16px;
          padding:12px 14px;
          border-radius:12px;
          background:#F8FAFC;
          border:1px solid #E5EAF2;
          font-size:13px;
          color:#475569;
          line-height:1.6;
        }

        .su-note strong{
          color:#0F172A;
        }

        .su-foot-divider{
          height:1px;
          background:#F1F5F9;
          margin:18px 0;
        }

        .su-links{
          display:flex;
          align-items:center;
          justify-content:space-between;
          flex-wrap:wrap;
          gap:10px;
          font-size:13px;
          color:#64748B;
        }

        .su-links a{
          color:#1E3A5F;
          font-weight:700;
          text-decoration:none;
        }

        .su-links a:hover{
          text-decoration:underline;
        }

        @media (max-width: 580px){
          .su-row{
            grid-template-columns:1fr;
            gap:0;
          }
        }

        @media (max-width: 520px){
          .su-card{
            border-radius:16px;
          }
          .su-card-head{
            padding:22px 20px 20px;
          }
          .su-card-body{
            padding:20px 20px 24px;
          }
        }
      `}</style>

      <div class="su-wrap">
        <div class="su-card">
          <div class="su-card-head">
            <div class="su-card-head-badge">🚀 New workspace</div>
            <h2>Create your company workspace</h2>
            <p>Get your construction business set up with jobs, labor, invoicing, and reporting.</p>
            <div class="su-pricing">
              <span class="su-pricing-amount">$49</span>
              <span class="su-pricing-sub">/ month after free trial</span>
            </div>
          </div>

          <div class="su-card-body">
            {error ? (
              <div class="su-error">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            ) : null}

            <form method="post">
              <input type="hidden" name="csrf_token" value={csrfToken} />

              <div class="su-section-label">Company</div>

              <div class="su-row">
                <div class="su-field">
                  <label class="su-label" for="company_name">Company name</label>
                  <input
                    class="su-input"
                    id="company_name"
                    name="company_name"
                    value={formData?.company_name || ''}
                    placeholder="Taylor's HVAC"
                    required
                    autocomplete="organization"
                  />
                </div>
                <div class="su-field">
                  <label class="su-label" for="subdomain">Subdomain</label>
                  <input
                    class="su-input"
                    id="subdomain"
                    name="subdomain"
                    value={formData?.subdomain || ''}
                    placeholder="taylors"
                    required
                    autocomplete="off"
                    autocapitalize="none"
                    spellcheck={false}
                  />
                  <div class="su-hint">Your workspace address prefix</div>
                </div>
              </div>

              <div class="su-divider"></div>
              <div class="su-section-label">Admin account</div>

              <div class="su-row">
                <div class="su-field">
                  <label class="su-label" for="admin_name">Your name</label>
                  <input
                    class="su-input"
                    id="admin_name"
                    name="admin_name"
                    value={formData?.admin_name || ''}
                    placeholder="Christopher Hudson"
                    required
                    autocomplete="name"
                  />
                </div>
                <div class="su-field">
                  <label class="su-label" for="admin_email">Admin email</label>
                  <input
                    class="su-input"
                    id="admin_email"
                    name="admin_email"
                    type="email"
                    value={formData?.admin_email || ''}
                    placeholder="name@company.com"
                    required
                    autocomplete="email"
                  />
                </div>
              </div>

              <div class="su-field">
                <label class="su-label" for="password">Password</label>
                <input
                  class="su-input"
                  id="password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  required
                  autocomplete="new-password"
                />
              </div>

              {inviteOnly ? (
                <div class="su-field">
                  <label class="su-label" for="invite_code">Invite code</label>
                  <input
                    class="su-input"
                    id="invite_code"
                    name="invite_code"
                    type="password"
                    value={formData?.invite_code || ''}
                    placeholder="Enter your launch code"
                    required
                    autocomplete="off"
                  />
                </div>
              ) : null}

              <button class="su-submit" type="submit">
                Create workspace →
              </button>
            </form>

            <div class="su-note">
              <strong>Subdomain tip:</strong> Choose something short and recognizable — e.g. <strong>taylors</strong> becomes <strong>taylors.your-domain.com</strong>. You can't change it later without support.
            </div>

            <div class="su-foot-divider"></div>

            <div class="su-links">
              <span>Already have a workspace?</span>
              <a href="/pick-tenant">Sign in →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
