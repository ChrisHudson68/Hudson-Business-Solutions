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

const cardStyle =
  'background:#fff;border:1px solid #E5EAF2;border-radius:16px;padding:20px;box-shadow:0 10px 26px rgba(15,23,42,.08);';

const inputStyle =
  'width:100%;min-height:44px;padding:10px 12px;border:1px solid #D7DFEA;border-radius:12px;background:#fff;font:inherit;';

const labelStyle = 'display:block;font-size:13px;font-weight:800;margin:0 0 8px;color:#0F172A;';
const helpStyle = 'margin:6px 0 0;font-size:12px;color:#64748B;';
const buttonStyle =
  'display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 14px;border:none;border-radius:12px;background:#1E3A5F;color:#fff;font-weight:900;font-size:13px;cursor:pointer;';
const alertErrorStyle =
  'margin:0 0 16px;padding:12px 14px;border-radius:12px;border:1px solid #F5C2C7;background:#FFF5F5;color:#991B1B;font-weight:700;';
const alertSuccessStyle =
  'margin:0 0 16px;padding:12px 14px;border-radius:12px;border:1px solid #BBF7D0;background:#F0FDF4;color:#166534;font-weight:700;';

export const MyAccountPage: FC<MyAccountPageProps> = ({ currentUser, formData, error, success, csrfToken }) => {
  const name = formData?.name ?? currentUser.name ?? '';
  const email = formData?.email ?? currentUser.email ?? '';

  return (
    <div style="display:grid;gap:18px;">
      <section style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div>
          <h1 style="margin:0;font-size:24px;letter-spacing:-.3px;color:#0F172A;">My Account</h1>
          <p style="margin:8px 0 0;color:#64748B;">
            Update your profile details and change your password.
          </p>
        </div>
      </section>

      <div style="display:grid;grid-template-columns:minmax(0,760px);gap:18px;">
        <section style={cardStyle}>
          {error ? <div style={alertErrorStyle}>{error}</div> : null}
          {success ? <div style={alertSuccessStyle}>{success}</div> : null}

          <form method="post" action="/my-account" style="display:grid;gap:18px;">
            <input type="hidden" name="_csrf" value={csrfToken} />

            <div style="display:grid;gap:14px;">
              <div>
                <label style={labelStyle} for="name">Full Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={name}
                  required
                  maxLength={120}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle} for="email">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  disabled
                  style={`${inputStyle};background:#F8FAFC;color:#64748B;`}
                />
                <p style={helpStyle}>Email changes are managed by an administrator.</p>
              </div>

              <div>
                <label style={labelStyle} for="role">Role</label>
                <input
                  id="role"
                  type="text"
                  value={currentUser.role}
                  disabled
                  style={`${inputStyle};background:#F8FAFC;color:#64748B;`}
                />
              </div>
            </div>

            <div style="border-top:1px solid #E5EAF2;padding-top:18px;display:grid;gap:14px;">
              <div>
                <h2 style="margin:0 0 6px;font-size:18px;color:#0F172A;">Change Password</h2>
                <p style="margin:0;color:#64748B;font-size:14px;">
                  Leave both password fields blank if you do not want to change it.
                </p>
              </div>

              <div>
                <label style={labelStyle} for="new_password">New Password</label>
                <input
                  id="new_password"
                  name="new_password"
                  type="password"
                  style={inputStyle}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label style={labelStyle} for="confirm_password">Confirm New Password</label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  style={inputStyle}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div style="display:flex;justify-content:flex-start;">
              <button type="submit" style={buttonStyle}>Save Changes</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default MyAccountPage;