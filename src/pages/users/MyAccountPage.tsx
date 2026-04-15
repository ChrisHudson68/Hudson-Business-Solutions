import type { FC } from 'hono/jsx';

interface MyAccountPageProps {
  currentUser: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  formData?: {
    name: string;
    email: string;
  };
  error?: string;
  success?: string;
  csrfToken: string;
}

export const MyAccountPage: FC<MyAccountPageProps> = ({ currentUser, formData, error, success, csrfToken }) => {
  const name = formData?.name ?? currentUser.name ?? '';
  const email = formData?.email ?? currentUser.email ?? '';

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>My Account</h1>
          <p>Update your profile details and change your password.</p>
        </div>
      </div>

      <div style="max-width:760px;">
        {error ? (
          <div class="card" style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">
            {error}
          </div>
        ) : null}

        {success ? (
          <div class="card" style="margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;">
            {success}
          </div>
        ) : null}

        <div class="card">
          <div class="card-head" style="margin-bottom:14px;">
            <h3>Profile</h3>
            <span class="badge">{currentUser.role}</span>
          </div>

          <form method="post" action="/my-account">
            <input type="hidden" name="csrf_token" value={csrfToken} />

            <label>Full Name</label>
            <input name="name" type="text" value={name} required maxLength={120} />

            <label>Email Address</label>
            <input name="email" type="email" value={email} disabled style="background:#F8FAFC; color:#64748B;" />
            <div class="muted" style="margin-top:6px; font-size:12px;">Email changes are managed by an administrator.</div>

            <label style="margin-top:14px;">Role</label>
            <input type="text" value={currentUser.role} disabled style="background:#F8FAFC; color:#64748B;" />

            <div style="border-top:1px solid var(--border); margin-top:20px; padding-top:20px;">
              <h3 style="margin:0 0 6px;">Change Password</h3>
              <p class="muted" style="margin:0 0 14px; font-size:14px;">
                Leave both fields blank if you do not want to change your password.
              </p>

              <label>New Password</label>
              <input name="new_password" type="password" autoComplete="new-password" />

              <label>Confirm New Password</label>
              <input name="confirm_password" type="password" autoComplete="new-password" />
            </div>

            <div class="actions" style="margin-top:16px;">
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MyAccountPage;
