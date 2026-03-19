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
        .signup-shell{
          display:grid;
          grid-template-columns:minmax(0, 1.05fr) minmax(360px, 0.95fr);
          gap:22px;
          align-items:start;
        }

        .signup-panel{
          display:flex;
          flex-direction:column;
          gap:16px;
        }

        .signup-hero{
          background:linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 14px 34px rgba(15,23,42,0.06);
          padding:26px;
        }

        .signup-eyebrow{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border-radius:999px;
          border:1px solid #DBEAFE;
          background:#EFF6FF;
          color:#1D4ED8;
          font-size:12px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
          margin-bottom:14px;
        }

        .signup-title{
          margin:0 0 10px;
          font-size:38px;
          line-height:1.05;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .signup-copy{
          margin:0;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
          max-width:760px;
        }

        .signup-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0,1fr));
          gap:14px;
        }

        .signup-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:18px;
          box-shadow:0 10px 24px rgba(15,23,42,0.05);
          padding:18px;
        }

        .signup-card-title{
          font-size:17px;
          font-weight:900;
          color:#0F172A;
          margin-bottom:8px;
        }

        .signup-card-copy{
          color:#64748B;
          line-height:1.75;
          font-size:14px;
        }

        .signup-checklist{
          display:grid;
          gap:10px;
        }

        .signup-check{
          display:flex;
          align-items:flex-start;
          gap:10px;
          color:#334155;
          line-height:1.7;
          font-size:14px;
        }

        .signup-check-mark{
          color:#15803D;
          font-weight:900;
          flex:0 0 auto;
        }

        .signup-form-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 14px 34px rgba(15,23,42,0.06);
          padding:24px;
        }

        .signup-form-title{
          margin:0 0 8px;
          font-size:28px;
          line-height:1.1;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .signup-form-copy{
          margin:0 0 18px;
          color:#64748B;
          line-height:1.75;
        }

        .signup-note{
          margin-top:14px;
          padding:14px 16px;
          border-radius:16px;
          border:1px solid #E5EAF2;
          background:#F8FAFC;
          color:#475569;
          line-height:1.7;
          font-size:14px;
        }

        .signup-note strong{
          color:#0F172A;
        }

        .signup-error{
          margin-bottom:14px;
          border:1px solid #FECACA;
          background:#FEF2F2;
          color:#991B1B;
          border-radius:14px;
          padding:12px 14px;
          line-height:1.6;
          font-weight:700;
        }

        .signup-help{
          margin-top:16px;
          color:#64748B;
          line-height:1.7;
          font-size:14px;
        }

        .signup-help a{
          font-weight:700;
        }

        .signup-mini-list{
          display:grid;
          gap:8px;
          margin-top:14px;
        }

        .signup-mini-item{
          padding:12px 14px;
          border-radius:14px;
          background:#F8FAFC;
          border:1px solid #E5EAF2;
          color:#475569;
          line-height:1.65;
          font-size:14px;
        }

        .signup-price{
          display:flex;
          align-items:flex-end;
          gap:6px;
          margin:12px 0 14px;
        }

        .signup-price-main{
          font-size:44px;
          line-height:1;
          font-weight:900;
          letter-spacing:-0.04em;
          color:#0F172A;
        }

        .signup-price-sub{
          font-size:14px;
          color:#64748B;
          font-weight:700;
          margin-bottom:6px;
        }

        @media (max-width: 980px){
          .signup-shell{
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 640px){
          .signup-hero,
          .signup-form-card{
            padding:18px;
          }

          .signup-title{
            font-size:31px;
          }

          .signup-grid{
            grid-template-columns:1fr;
          }

          .signup-form-title{
            font-size:24px;
          }

          .signup-price-main{
            font-size:36px;
          }
        }
      `}</style>

      <div class="signup-shell">
        <div class="signup-panel">
          <div class="signup-hero">
            <div class="signup-eyebrow">Create your company workspace</div>
            <h1 class="signup-title">Start with a clean, professional system for your construction business.</h1>
            <p class="signup-copy">
              Hudson Business Solutions helps you bring jobs, labor tracking, invoices,
              payments, and reporting into one organized workspace so your team can operate
              with better visibility and less confusion.
            </p>

            <div class="signup-price">
              <div class="signup-price-main">$49</div>
              <div class="signup-price-sub">/ month</div>
            </div>

            <div class="signup-checklist">
              <div class="signup-check">
                <span class="signup-check-mark">✔</span>
                <span>One company workspace with isolated data, users, settings, and billing.</span>
              </div>
              <div class="signup-check">
                <span class="signup-check-mark">✔</span>
                <span>Job costing, employee tracking, invoicing, payments, and reporting in one place.</span>
              </div>
              <div class="signup-check">
                <span class="signup-check-mark">✔</span>
                <span>Owner-operator friendly workflows designed for real construction operations.</span>
              </div>
            </div>
          </div>

          <div class="signup-grid">
            <div class="signup-card">
              <div class="signup-card-title">What happens after signup</div>
              <div class="signup-card-copy">
                Your company workspace is created, your admin account is set up, and you can begin
                entering jobs, employees, and invoices right away.
              </div>
            </div>

            <div class="signup-card">
              <div class="signup-card-title">Best first steps</div>
              <div class="signup-card-copy">
                After creating your workspace, complete company settings first, then add your first
                job, employee, and invoice to unlock the full onboarding flow.
              </div>
            </div>

            <div class="signup-card">
              <div class="signup-card-title">Built for clarity</div>
              <div class="signup-card-copy">
                The goal is not more software to babysit. The goal is a cleaner operating system for
                project finances, labor visibility, and billing.
              </div>
            </div>

            <div class="signup-card">
              <div class="signup-card-title">Support built in</div>
              <div class="signup-card-copy">
                Billing tools and in-app support workflows are part of the platform so your team has
                a clearer path when questions or issues come up.
              </div>
            </div>
          </div>
        </div>

        <div class="signup-form-card">
          <h2 class="signup-form-title">Create your workspace</h2>
          <p class="signup-form-copy">
            Set up your company and initial admin account to start using Hudson Business Solutions.
          </p>

          {error ? (
            <div class="signup-error">
              {error}
            </div>
          ) : null}

          <form method="post">
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <label>Company Name</label>
            <input
              name="company_name"
              value={formData?.company_name || ''}
              placeholder="Example: Taylor's HVAC"
              required
            />

            <label>Subdomain</label>
            <input
              name="subdomain"
              value={formData?.subdomain || ''}
              placeholder="example: taylors"
              required
            />

            <label>Admin Name</label>
            <input
              name="admin_name"
              value={formData?.admin_name || ''}
              placeholder="Example: Christopher Hudson"
              required
            />

            <label>Admin Email</label>
            <input
              name="admin_email"
              type="email"
              value={formData?.admin_email || ''}
              placeholder="name@company.com"
              required
            />

            <label>Password</label>
            <input
              name="password"
              type="password"
              placeholder="At least 8 characters"
              required
            />

            {inviteOnly ? (
              <>
                <label>Invite Code</label>
                <input
                  name="invite_code"
                  type="password"
                  value={formData?.invite_code || ''}
                  placeholder="Enter your launch code"
                  required
                />
              </>
            ) : null}

            <div class="actions" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit">
                Create Workspace
              </button>
            </div>
          </form>

          <div class="signup-note">
            <strong>Tip:</strong> Your subdomain becomes your company login address. For example,
            a subdomain of <strong>taylors</strong> would use a workspace like <strong>taylors.your-domain</strong>
            in production or <strong>taylors.localhost</strong> in development.
          </div>

          <div class="signup-mini-list">
            <div class="signup-mini-item">
              Use your real company name so invoices, settings, and workspace details start out clean.
            </div>
            <div class="signup-mini-item">
              Choose a short, professional subdomain that your team will recognize easily.
            </div>
            <div class="signup-mini-item">
              Use an admin email that you want tied to billing, setup, and day-to-day account ownership.
            </div>
          </div>

          <div class="signup-help">
            Already have a company workspace? <a href="/pick-tenant">Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;