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
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-head">
          <h1>Create your workspace</h1>
          <p>Set up your company and admin account to start using Hudson Business Solutions.</p>
        </div>

        {error ? (
          <div
            class="card"
            style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;"
          >
            {error}
          </div>
        ) : null}

        <form method="post">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Company Name</label>
          <input
            name="company_name"
            value={formData?.company_name || ''}
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
            required
          />

          <label>Admin Email</label>
          <input
            name="admin_email"
            type="email"
            value={formData?.admin_email || ''}
            required
          />

          <label>Password</label>
          <input
            name="password"
            type="password"
            required
          />

          {inviteOnly ? (
            <>
              <label>Invite Code</label>
              <input
                name="invite_code"
                type="password"
                value={formData?.invite_code || ''}
                required
              />
            </>
          ) : null}

          <div style="margin-top:16px;" class="actions">
            <button class="btn btn-primary" type="submit">
              Create Workspace
            </button>
          </div>
        </form>

        <div class="muted" style="margin-top:14px;">
          Already have a company workspace? <a href="/pick-tenant">Sign in</a>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;