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
  const tenantName = currentTenant?.name || 'Hudson Business Solutions';

  return (
    <div>
      <style>{`
        .li-wrap{
          display:flex;
          justify-content:center;
          padding:8px 0 24px;
        }

        .li-card{
          width:min(460px, 100%);
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:20px;
          box-shadow:0 16px 40px rgba(15,23,42,0.09);
          overflow:hidden;
        }

        .li-card-head{
          background:linear-gradient(135deg, #0F1F35 0%, #1E3A5F 100%);
          padding:28px 28px 24px;
        }

        .li-tenant-badge{
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

        .li-card-head h2{
          margin:0 0 6px;
          font-size:22px;
          font-weight:800;
          color:#FFFFFF;
          letter-spacing:-0.02em;
          line-height:1.2;
        }

        .li-card-head p{
          margin:0;
          font-size:14px;
          color:rgba(255,255,255,0.60);
          line-height:1.6;
        }

        .li-card-body{
          padding:24px 28px 28px;
        }

        .li-error{
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

        .li-label{
          display:block;
          font-size:13px;
          font-weight:700;
          color:#334155;
          margin-bottom:6px;
        }

        .li-field{
          margin-bottom:14px;
        }

        .li-input{
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

        .li-input:focus{
          border-color:#1E3A5F;
          background:#FFFFFF;
          box-shadow:0 0 0 4px rgba(30,58,95,0.10);
        }

        .li-submit{
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

        .li-submit:hover{
          filter:brightness(1.06);
        }

        .li-submit:active{
          transform:scale(0.99);
        }

        .li-divider{
          height:1px;
          background:#F1F5F9;
          margin:20px 0;
        }

        .li-links{
          display:flex;
          align-items:center;
          justify-content:space-between;
          flex-wrap:wrap;
          gap:10px;
          font-size:13px;
          color:#64748B;
        }

        .li-links a{
          color:#1E3A5F;
          font-weight:700;
          text-decoration:none;
        }

        .li-links a:hover{
          text-decoration:underline;
        }

        @media (max-width: 520px){
          .li-card{
            border-radius:16px;
          }
          .li-card-head{
            padding:22px 20px 20px;
          }
          .li-card-body{
            padding:20px 20px 24px;
          }
        }
      `}</style>

      <div class="li-wrap">
        <div class="li-card">
          <div class="li-card-head">
            {currentTenant ? (
              <div class="li-tenant-badge">
                🏢 {currentTenant.subdomain}
              </div>
            ) : (
              <div class="li-tenant-badge">
                🔑 Workspace sign in
              </div>
            )}
            <h2>
              {currentTenant ? `Sign in to ${tenantName}` : 'Sign in'}
            </h2>
            <p>
              {currentTenant
                ? 'Access your jobs, timesheets, invoices, and reporting.'
                : 'Use your company credentials to access your workspace.'}
            </p>
          </div>

          <div class="li-card-body">
            {error ? (
              <div class="li-error">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            ) : null}

            <form method="post" action="/login">
              <input type="hidden" name="csrf_token" value={csrfToken} />

              <div class="li-field">
                <label class="li-label" for="email">Email address</label>
                <input
                  class="li-input"
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={prefillEmail || ''}
                  placeholder="you@company.com"
                  autocomplete="email"
                />
              </div>

              <div class="li-field">
                <label class="li-label" for="password">Password</label>
                <input
                  class="li-input"
                  type="password"
                  id="password"
                  name="password"
                  required
                  placeholder="Enter your password"
                  autocomplete="current-password"
                />
              </div>

              <button class="li-submit" type="submit">
                Sign in →
              </button>
            </form>

            <div class="li-divider"></div>

            <div class="li-links">
              {currentTenant ? (
                <>
                  <span>Wrong workspace?</span>
                  <a href={findWorkspaceUrl}>Find workspace →</a>
                </>
              ) : (
                <>
                  <a href={findWorkspaceUrl}>Find your workspace</a>
                  <a href="/signup">Create workspace</a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
