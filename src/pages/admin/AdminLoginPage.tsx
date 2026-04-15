import type { FC } from 'hono/jsx';

interface AdminLoginPageProps {
  error?: string;
  prefillEmail?: string;
  csrfToken: string;
}

export const AdminLoginPage: FC<AdminLoginPageProps> = ({
  error,
  prefillEmail,
  csrfToken,
}) => {
  return (
    <div style="max-width:620px; margin:60px auto;">
      <div class="card" style="padding:28px;">
        <div class="page-head" style="text-align:left; margin-bottom:20px;">
          <h1>Platform Admin Login</h1>
          <p>Access the owner portal for Hudson Business Solutions.</p>
        </div>

        {error ? (
          <div class="card" style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">
            {error}
          </div>
        ) : null}

        <form method="post" action="/admin/login">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label for="email">Admin Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={prefillEmail || ''}
            placeholder="you@yourdomain.com"
          />

          <label for="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="Enter your platform admin password"
          />

          <div class="actions" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Sign In</button>
            <a class="btn" href="/">Back to Site</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;