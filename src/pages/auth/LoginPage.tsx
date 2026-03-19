import type { FC } from 'hono/jsx';

interface LoginPageProps {
  error?: string;
  prefillEmail?: string;
  csrfToken: string;
  currentTenant: { id: number; name: string; subdomain: string; logo_path: string | null } | null;
  findWorkspaceUrl: string;
}

export const LoginPage: FC<LoginPageProps> = ({
  error,
  prefillEmail,
  csrfToken,
  currentTenant,
  findWorkspaceUrl,
}) => {
  const tenantName = currentTenant?.name || 'your company workspace';
  const tenantSubdomain = currentTenant?.subdomain || '';

  return (
    <div>
      <style>{`
        .login-shell{
          display:grid;
          grid-template-columns:minmax(0, 1.02fr) minmax(360px, 0.98fr);
          gap:22px;
          align-items:start;
        }

        .login-panel{
          display:flex;
          flex-direction:column;
          gap:16px;
        }

        .login-hero{
          background:linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 14px 34px rgba(15,23,42,0.06);
          padding:26px;
        }

        .login-eyebrow{
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

        .login-title{
          margin:0 0 10px;
          font-size:38px;
          line-height:1.05;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .login-copy{
          margin:0;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
          max-width:760px;
        }

        .login-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0,1fr));
          gap:14px;
        }

        .login-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:18px;
          box-shadow:0 10px 24px rgba(15,23,42,0.05);
          padding:18px;
        }

        .login-card-title{
          font-size:17px;
          font-weight:900;
          color:#0F172A;
          margin-bottom:8px;
        }

        .login-card-copy{
          color:#64748B;
          line-height:1.75;
          font-size:14px;
        }

        .login-form-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 14px 34px rgba(15,23,42,0.06);
          padding:24px;
        }

        .login-form-title{
          margin:0 0 8px;
          font-size:28px;
          line-height:1.1;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .login-form-copy{
          margin:0 0 18px;
          color:#64748B;
          line-height:1.75;
        }

        .login-tenant-pill{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:9px 12px;
          border-radius:999px;
          background:#F8FAFC;
          border:1px solid #E5EAF2;
          color:#334155;
          font-size:13px;
          font-weight:800;
          margin-bottom:14px;
        }

        .login-error{
          margin-bottom:14px;
          border:1px solid #FECACA;
          background:#FEF2F2;
          color:#991B1B;
          border-radius:14px;
          padding:12px 14px;
          line-height:1.6;
          font-weight:700;
        }

        .login-note{
          margin-top:14px;
          padding:14px 16px;
          border-radius:16px;
          border:1px solid #E5EAF2;
          background:#F8FAFC;
          color:#475569;
          line-height:1.7;
          font-size:14px;
        }

        .login-note strong{
          color:#0F172A;
        }

        .login-mini-list{
          display:grid;
          gap:8px;
          margin-top:14px;
        }

        .login-mini-item{
          padding:12px 14px;
          border-radius:14px;
          background:#F8FAFC;
          border:1px solid #E5EAF2;
          color:#475569;
          line-height:1.65;
          font-size:14px;
        }

        .login-help{
          margin-top:16px;
          color:#64748B;
          line-height:1.7;
          font-size:14px;
        }

        .login-help a{
          font-weight:700;
        }

        @media (max-width: 980px){
          .login-shell{
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 640px){
          .login-hero,
          .login-form-card{
            padding:18px;
          }

          .login-title{
            font-size:31px;
          }

          .login-grid{
            grid-template-columns:1fr;
          }

          .login-form-title{
            font-size:24px;
          }
        }
      `}</style>

      <div class="login-shell">
        <div class="login-panel">
          <div class="login-hero">
            <div class="login-eyebrow">
              {currentTenant ? 'Company workspace sign in' : 'Workspace access'}
            </div>

            <h1 class="login-title">
              {currentTenant
                ? `Sign in to ${tenantName}`
                : 'Sign in to your Hudson Business Solutions workspace'}
            </h1>

            <p class="login-copy">
              {currentTenant
                ? 'Access your company workspace to manage jobs, labor, invoices, payments, and reporting.'
                : 'Use your company workspace credentials to access your construction operations platform.'}
            </p>
          </div>

          <div class="login-grid">
            <div class="login-card">
              <div class="login-card-title">Built for your company workspace</div>
              <div class="login-card-copy">
                Each company signs in to its own isolated workspace with its own users, settings, and business data.
              </div>
            </div>

            <div class="login-card">
              <div class="login-card-title">Need the right workspace first?</div>
              <div class="login-card-copy">
                If you are not sure which company workspace to use, start with the Find Workspace page instead of guessing.
              </div>
            </div>

            <div class="login-card">
              <div class="login-card-title">Use your company credentials</div>
              <div class="login-card-copy">
                Sign in with the email and password connected to your company account, not a personal account unless your company uses it.
              </div>
            </div>

            <div class="login-card">
              <div class="login-card-title">New company setup</div>
              <div class="login-card-copy">
                If your company has not created a workspace yet, start by creating one and setting up your admin account.
              </div>
            </div>
          </div>
        </div>

        <div class="login-form-card">
          <h2 class="login-form-title">Sign in</h2>
          <p class="login-form-copy">
            Enter your account details to continue.
          </p>

          {currentTenant ? (
            <div class="login-tenant-pill">
              Workspace: {tenantName}{tenantSubdomain ? ` (${tenantSubdomain})` : ''}
            </div>
          ) : null}

          {error ? (
            <div class="login-error">
              {error}
            </div>
          ) : null}

          <form method="post" action="/login">
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={prefillEmail || ''}
              placeholder="you@company.com"
            />

            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              required
              placeholder="Enter your password"
            />

            <div class="actions" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit">Sign In</button>
              {!currentTenant ? (
                <a class="btn" href={findWorkspaceUrl}>Find Workspace</a>
              ) : null}
            </div>
          </form>

          <div class="login-note">
            <strong>Tip:</strong> {currentTenant
              ? `Make sure you are signing in to the correct company workspace for ${tenantName}.`
              : 'If your sign-in page does not look familiar, use Find Workspace first to get to the correct company login page.'}
          </div>

          <div class="login-mini-list">
            <div class="login-mini-item">
              If your company invited you recently, use the same email address that received the invitation or setup instructions.
            </div>
            <div class="login-mini-item">
              If your company has multiple people using the platform, each user should sign in with their own account.
            </div>
            <div class="login-mini-item">
              If your company is not set up yet, create a workspace instead of trying to sign in here.
            </div>
          </div>

          <div class="login-help">
            {!currentTenant ? (
              <>
                Need a new company workspace? <a href="/signup">Create Workspace</a>
              </>
            ) : (
              <>
                Not your company workspace? <a href={findWorkspaceUrl}>Find Workspace</a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;