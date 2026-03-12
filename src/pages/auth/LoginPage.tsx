import type { FC } from 'hono/jsx';

interface LoginPageProps {
  error?: string;
  prefillEmail?: string;
  csrfToken: string;
  currentTenant: { id: number; name: string; subdomain: string; logo_path: string | null } | null;
}

export const LoginPage: FC<LoginPageProps> = ({
  error,
  prefillEmail,
  csrfToken,
  currentTenant,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Sign in to Hudson Business Solutions</h1>
          <p class="muted">
            {currentTenant
              ? 'Access your company workspace.'
              : 'Sign in to your workspace.'}
          </p>
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
              <a class="btn" href="/pick-tenant">Find Workspace</a>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
