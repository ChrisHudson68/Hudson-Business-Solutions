import type { FC } from 'hono/jsx';

interface PickTenantPageProps {
  error?: string;
  formData: {
    subdomain: string;
  };
  csrfToken: string;
}

export const PickTenantPage: FC<PickTenantPageProps> = ({
  error,
  formData,
  csrfToken,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Find Your Workspace</h1>
          <p class="muted">Enter your company subdomain to continue to your Hudson Business Solutions login page.</p>
        </div>
      </div>

      <div class="card" style="max-width:620px;">
        {error ? (
          <div
            class="badge badge-bad"
            style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;"
          >
            {error}
          </div>
        ) : null}

        <form method="post" action="/pick-tenant">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label for="subdomain">Company Subdomain</label>
          <input
            type="text"
            id="subdomain"
            name="subdomain"
            required
            value={formData.subdomain || ''}
            placeholder="acme"
          />

          <div class="muted" style="margin-top:8px; font-size:12px;">
            Enter the subdomain your company uses for Hudson Business Solutions.
          </div>

          <div class="actions" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Continue</button>
            <a class="btn" href="/signup">Create Workspace</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PickTenantPage;
