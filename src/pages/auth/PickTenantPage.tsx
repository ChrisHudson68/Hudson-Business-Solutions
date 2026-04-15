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
        .pt-wrap{
          display:flex;
          justify-content:center;
          padding:8px 0 24px;
        }

        .pt-card{
          width:min(460px, 100%);
          background:#FFFFFF;
          border:1px solid #E5EAF2;
          border-radius:20px;
          box-shadow:0 16px 40px rgba(15,23,42,0.09);
          overflow:hidden;
        }

        .pt-card-head{
          background:linear-gradient(135deg, #0F1F35 0%, #1E3A5F 100%);
          padding:28px 28px 24px;
          position:relative;
        }

        .pt-card-head-icon{
          width:44px;
          height:44px;
          border-radius:12px;
          background:rgba(245,158,11,0.18);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:22px;
          margin-bottom:14px;
          border:1px solid rgba(245,158,11,0.25);
        }

        .pt-card-head h2{
          margin:0 0 6px;
          font-size:22px;
          font-weight:800;
          color:#FFFFFF;
          letter-spacing:-0.02em;
          line-height:1.2;
        }

        .pt-card-head p{
          margin:0;
          font-size:14px;
          color:rgba(255,255,255,0.65);
          line-height:1.6;
        }

        .pt-card-body{
          padding:24px 28px 28px;
        }

        .pt-error{
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

        .pt-local-error{
          display:none;
          margin-top:12px;
          border:1px solid #FECACA;
          background:#FEF2F2;
          color:#991B1B;
          border-radius:12px;
          padding:11px 14px;
          line-height:1.6;
          font-size:14px;
          font-weight:600;
        }

        .pt-label{
          display:block;
          font-size:13px;
          font-weight:700;
          color:#334155;
          margin-bottom:6px;
        }

        .pt-input-wrap{
          position:relative;
        }

        .pt-input{
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

        .pt-input:focus{
          border-color:#1E3A5F;
          background:#FFFFFF;
          box-shadow:0 0 0 4px rgba(30,58,95,0.10);
        }

        .pt-hint{
          margin-top:7px;
          font-size:12.5px;
          color:#94A3B8;
          line-height:1.55;
        }

        .pt-submit{
          width:100%;
          margin-top:20px;
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

        .pt-submit:hover{
          filter:brightness(1.06);
        }

        .pt-submit:active{
          transform:scale(0.99);
        }

        .pt-divider{
          height:1px;
          background:#F1F5F9;
          margin:20px 0;
        }

        .pt-links{
          display:flex;
          align-items:center;
          justify-content:space-between;
          flex-wrap:wrap;
          gap:10px;
          font-size:13px;
          color:#64748B;
        }

        .pt-links a{
          color:#1E3A5F;
          font-weight:700;
          text-decoration:none;
        }

        .pt-links a:hover{
          text-decoration:underline;
        }

        .pt-help-tip{
          margin-top:16px;
          padding:12px 14px;
          border-radius:12px;
          background:#F8FAFC;
          border:1px solid #E5EAF2;
          font-size:13px;
          color:#475569;
          line-height:1.6;
        }

        .pt-help-tip strong{
          color:#0F172A;
        }

        @media (max-width: 520px){
          .pt-card{
            border-radius:16px;
          }
          .pt-card-head{
            padding:22px 20px 20px;
          }
          .pt-card-body{
            padding:20px 20px 24px;
          }
        }
      `}</style>

      <div class="pt-wrap">
        <div class="pt-card">
          <div class="pt-card-head">
            <div class="pt-card-head-icon">🏢</div>
            <h2>Find your workspace</h2>
            <p>Enter your company subdomain to go to your sign-in page.</p>
          </div>

          <div class="pt-card-body">
            {error ? (
              <div class="pt-error">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            ) : null}

            <form method="post" action="/pick-tenant" data-pick-tenant-form>
              <input type="hidden" name="csrf_token" value={csrfToken} />

              <label class="pt-label" for="subdomain">Company subdomain</label>
              <div class="pt-input-wrap">
                <input
                  class="pt-input"
                  type="text"
                  id="subdomain"
                  name="subdomain"
                  data-pick-tenant-input
                  required
                  value={formData.subdomain || ''}
                  placeholder="e.g. taylors"
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck={false}
                />
              </div>
              <div class="pt-hint">
                The short company name at the front of your workspace address — e.g. <strong>taylors</strong> in <strong>taylors.your-domain.com</strong>
              </div>

              <div class="pt-local-error" data-pick-tenant-local-error></div>

              <button class="pt-submit" type="submit">
                Continue to sign in →
              </button>
            </form>

            <script dangerouslySetInnerHTML={{ __html: pickTenantLocalRedirectScript }} />

            <div class="pt-divider"></div>

            <div class="pt-links">
              <span>Don't have a workspace?</span>
              <a href="/signup">Create one →</a>
            </div>

            <div class="pt-help-tip">
              <strong>Not sure of your subdomain?</strong> Check with your company admin — it's the same short name your team uses every time they sign in.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PickTenantPage;
