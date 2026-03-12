import type { FC } from 'hono/jsx';

interface AddUserPageProps {
  error?: string;
  formData?: {
    name: string;
    email: string;
    role: string;
  };
  csrfToken: string;
}

export const AddUserPage: FC<AddUserPageProps> = ({
  error,
  formData,
  csrfToken,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Add User</h1>
          <p>Create a user and assign a role.</p>
        </div>
        <div class="actions">
          <a class="btn" href="/users">Back</a>
        </div>
      </div>

      <div class="card">
        {error ? (
          <div
            class="badge badge-bad"
            style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;"
          >
            {error}
          </div>
        ) : null}

        <form method="post">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Name</label>
          <input name="name" required value={formData?.name || ''} />

          <label>Email</label>
          <input name="email" type="email" required value={formData?.email || ''} />

          <label>Role</label>
          <select name="role">
            <option value="Admin" selected={formData?.role === 'Admin'}>Admin</option>
            <option value="Manager" selected={formData?.role === 'Manager'}>Manager</option>
            <option
              value="Employee"
              selected={!formData?.role || formData?.role === 'Employee'}
            >
              Employee
            </option>
          </select>

          <label>Password</label>
          <input name="password" type="password" required />

          <div style="margin-top:16px;" class="actions">
            <button class="btn btn-primary" type="submit">Create User</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserPage;