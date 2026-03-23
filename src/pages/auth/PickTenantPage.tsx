import type { FC } from 'hono/jsx';

interface PickTenantPageProps {
  error?: string;
  formData: {
    subdomain: string;
  };
  csrfToken: string;
}

const pickTenantLocalRedirectScript = `
(function () {
  function isLocalHostLike(hostname) {
    if (!hostname) return false;
    const host = String(hostname).toLowerCase();
    return host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '0.0.0.0';
  }

  function isValidSubdomain(value) {
    return /^[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?$/.test(value);
  }

  function attach() {
    const form = document.querySelector('[data-pick-tenant-form]');
    const input = document.querySelector('[data-pick-tenant-input]');
    const error = document.querySelector('[data-pick-tenant-local-error]');
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) return;

    form.addEventListener('submit', function (event) {
      const hostname = window.location.hostname || '';
      if (!isLocalHostLike(hostname)) return;

      const subdomain = input.value.trim().toLowerCase();
      if (!isValidSubdomain(subdomain)) return;

      event.preventDefault();

      if (error instanceof HTMLElement) {
        error.style.display = 'none';
        error.textContent = '';
      }

      const port = window.location.port ? ':' + window.location.port : '';
      const target = window.location.protocol + '//' + subdomain + '.localhost' + port + '/login';
      window.location.assign(target);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
`;

export const PickTenantPage: FC<PickTenantPageProps> = ({
  error,
  formData,
  csrfToken,
}) => {
  return (
    <div>
      <style>{`
        .pick-shell{
          display:grid;
          grid-template-columns:minmax(0, 1.02fr) minmax(360px, 0.98fr);
          gap:22px;
          align-items:start;
        }

        .pick-panel{
          display:flex;
          flex-direction:column;
          gap:16px;
        }

        .pick-hero{
          background:linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 14px 34px rgba(15,23,42,0.06);
          padding:26px;
        }

        .pick-eyebrow{
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

        .pick-title{
          margin:0 0 10px;
          font-size:38px;
          line-height:1.05;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .pick-copy{
          margin:0;
          color:#64748B;
          line-height:1.8;
          font-size:16px;
          max-width:760px;
        }

        .pick-grid{
          display:grid;
          grid-template-columns:repeat(2, minmax(0,1fr));
          gap:14px;
        }

        .pick-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:18px;
          box-shadow:0 10px 24px rgba(15,23,42,0.05);
          padding:18px;
        }

        .pick-card-title{
          font-size:17px;
          font-weight:900;
          color:#0F172A;
          margin-bottom:8px;
        }

        .pick-card-copy{
          color:#64748B;
          line-height:1.75;
          font-size:14px;
        }

        .pick-form-card{
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:22px;
          box-shadow:0 14px 34px rgba(15,23,42,0.06);
          padding:24px;
        }

        .pick-form-title{
          margin:0 0 8px;
          font-size:28px;
          line-height:1.1;
          letter-spacing:-0.03em;
          color:#0F172A;
          font-weight:900;
        }

        .pick-form-copy{
          margin:0 0 18px;
          color:#64748B;
          line-height:1.75;
        }

        .pick-error{
          margin-bottom:14px;
          border:1px solid #FECACA;
          background:#FEF2F2;
          color:#991B1B;
          border-radius:14px;
          padding:12px 14px;
          line-height:1.6;
          font-weight:700;
        }

        .pick-note{
          margin-top:14px;
          padding:14px 16px;
          border-radius:16px;
          border:1px solid #E5EAF2;
          background:#F8FAFC;
          color:#475569;
          line-height:1.7;
          font-size:14px;
        }

        .pick-note strong{
          color:#0F172A;
        }

        .pick-mini-list{
          display:grid;
          gap:8px;
          margin-top:14px;
        }

        .pick-mini-item{
          padding:12px 14px;
          border-radius:14px;
          background:#F8FAFC;
          border:1px solid #E5EAF2;
          color:#475569;
          line-height:1.65;
          font-size:14px;
        }

        .pick-help{
          margin-top:16px;
          color:#64748B;
          line-height:1.7;
          font-size:14px;
        }

        .pick-help a{
          font-weight:700;
        }

        @media (max-width: 980px){
          .pick-shell{
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 640px){
          .pick-hero,
          .pick-form-card{
            padding:18px;
          }

          .pick-title{
            font-size:31px;
          }

          .pick-grid{
            grid-template-columns:1fr;
          }

          .pick-form-title{
            font-size:24px;
          }
        }
        .pick-local-error{
          display:none;
          margin-top:12px;
          border:1px solid #FECACA;
          background:#FEF2F2;
          color:#991B1B;
          border-radius:14px;
          padding:12px 14px;
          line-height:1.6;
          font-weight:700;
        }
      `}</style>

      <div class="pick-shell">
        <div class="pick-panel">
          <div class="pick-hero">
            <div class="pick-eyebrow">Find your company workspace</div>
            <h1 class="pick-title">Go to the right login page for your company.</h1>
            <p class="pick-copy">
              Hudson Business Solutions uses a separate workspace for each company.
              Enter your company subdomain to continue to the correct sign-in page.
            </p>
          </div>

          <div class="pick-grid">
            <div class="pick-card">
              <div class="pick-card-title">What is a workspace?</div>
              <div class="pick-card-copy">
                Each company has its own isolated workspace with its own users, settings,
                jobs, billing, and operational data.
              </div>
            </div>

            <div class="pick-card">
              <div class="pick-card-title">What is a subdomain?</div>
              <div class="pick-card-copy">
                It is the short company name at the front of your workspace address,
                such as <strong>taylors</strong> in a workspace like <strong>taylors.your-domain</strong>.
              </div>
            </div>

            <div class="pick-card">
              <div class="pick-card-title">Already know your workspace?</div>
              <div class="pick-card-copy">
                Enter the subdomain below and continue directly to your company sign-in page.
              </div>
            </div>

            <div class="pick-card">
              <div class="pick-card-title">Need a new workspace?</div>
              <div class="pick-card-copy">
                If your company is not set up yet, create a new workspace and start with your company admin account.
              </div>
            </div>
          </div>
        </div>

        <div class="pick-form-card">
          <h2 class="pick-form-title">Find your workspace</h2>
          <p class="pick-form-copy">
            Enter your company subdomain to continue.
          </p>

          {error ? (
            <div class="pick-error">
              {error}
            </div>
          ) : null}

          <form method="post" action="/pick-tenant" data-pick-tenant-form>
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <label for="subdomain">Company Subdomain</label>
            <input
              type="text"
              id="subdomain"
              name="subdomain"
              data-pick-tenant-input
              required
              value={formData.subdomain || ''}
              placeholder="example: taylors"
            />

            <div class="muted" style="margin-top:8px; font-size:13px; line-height:1.7;">
              Enter only the company portion of the workspace address.
            </div>

            <div class="actions" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit">Continue to Sign In</button>
              <a class="btn" href="/signup">Create Workspace</a>
            </div>
          </form>

          <div class="pick-local-error" data-pick-tenant-local-error></div>

          <script dangerouslySetInnerHTML={{ __html: pickTenantLocalRedirectScript }} />

          <div class="pick-note">
            <strong>Tip:</strong> If your team normally signs in at something like
            <strong> taylors.your-domain</strong>, your subdomain is <strong>taylors</strong>.
          </div>

          <div class="pick-mini-list">
            <div class="pick-mini-item">
              Check with your company admin if you are not sure which workspace your team uses.
            </div>
            <div class="pick-mini-item">
              If you were invited recently, use the same workspace your company gave you during setup.
            </div>
            <div class="pick-mini-item">
              If your company has not started yet, create a new workspace instead of guessing.
            </div>
          </div>

          <div class="pick-help">
            Already know your workspace and just need the login page? Go back to <a href="/login">sign in</a>.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PickTenantPage;