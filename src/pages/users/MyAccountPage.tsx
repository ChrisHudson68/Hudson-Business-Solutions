import type { FC } from 'hono/jsx';

interface MyAccountPageProps {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  csrfToken: string;
  error?: string;
  success?: string;
}

export const MyAccountPage: FC<MyAccountPageProps> = ({ user, csrfToken, error, success }) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>My Account</h1>
          <p class="muted">Review your account details and update your password.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/timesheet">Back to Timesheets</a>
        </div>
      </div>

      <div class="grid grid-2" style="align-items:start;">
        <div class="card">
          <h3 style="margin-top:0;">Account Details</h3>
          <div class="mobile-info-list">
            <div class="mobile-info-row">
              <span class="mobile-info-label">Name</span>
              <span class="mobile-info-value">{user.name}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Email</span>
              <span class="mobile-info-value">{user.email}</span>
            </div>
            <div class="mobile-info-row">
              <span class="mobile-info-label">Role</span>
              <span class="mobile-info-value">{user.role}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0;">Change Password</h3>

          {error ? (
            <div class="badge badge-bad" style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;">
              {error}
            </div>
          ) : null}

          {success ? (
            <div class="badge badge-good" style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;">
              {success}
            </div>
          ) : null}

          <form method="post" action="/my-account/password">
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <label>New Password</label>
            <input name="new_password" type="password" placeholder="Enter a new password" required />

            <label>Confirm New Password</label>
            <input name="confirm_password" type="password" placeholder="Re-enter the new password" required />

            <div class="muted small" style="margin-top:10px;">
              Use at least 8 characters. After saving, use the new password the next time you sign in.
            </div>

            <div class="actions actions-mobile-stack" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit">Update Password</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MyAccountPage;
