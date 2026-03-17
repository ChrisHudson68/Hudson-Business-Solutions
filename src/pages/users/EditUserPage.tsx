import type { FC } from 'hono/jsx';

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  active: number;
  employee_id: number | null;
}

interface EmployeeOption {
  id: number;
  name: string;
}

interface EditUserFormData {
  name: string;
  email: string;
  role: string;
  active: number;
  employee_id: string;
}

interface EditUserPageProps {
  user: UserRecord;
  employeeOptions: EmployeeOption[];
  formData?: EditUserFormData;
  error?: string;
  csrfToken: string;
}

export const EditUserPage: FC<EditUserPageProps> = ({
  user,
  employeeOptions,
  formData,
  error,
  csrfToken,
}) => {
  const values = {
    name: formData?.name ?? user.name,
    email: formData?.email ?? user.email,
    role: formData?.role ?? user.role,
    active: formData?.active ?? user.active,
    employee_id: formData?.employee_id ?? String(user.employee_id ?? ''),
  };

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit User</h1>
          <p class="muted">Update user info, role, employee link, or deactivate access.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/users">Back</a>
        </div>
      </div>

      <div class="card" style="max-width:760px;">
        {error ? (
          <div
            class="badge badge-bad"
            style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;"
          >
            {error}
          </div>
        ) : null}

        <form method="post" action={`/edit_user/${user.id}`}>
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Name</label>
          <input name="name" value={values.name} required />

          <label>Email</label>
          <input name="email" type="email" value={values.email} required />

          <label>Role</label>
          <select name="role">
            <option value="Admin" selected={values.role === 'Admin'}>Admin</option>
            <option value="Manager" selected={values.role === 'Manager'}>Manager</option>
            <option value="Employee" selected={values.role === 'Employee'}>Employee</option>
          </select>

          <label>Linked Employee Record</label>
          <select name="employee_id">
            <option value="">-- Not linked --</option>
            {employeeOptions.map((employee) => (
              <option
                value={String(employee.id)}
                selected={values.employee_id === String(employee.id)}
              >
                {employee.name}
              </option>
            ))}
          </select>

          <label>Active</label>
          <select name="active">
            <option value="1" selected={values.active === 1}>Active</option>
            <option value="0" selected={values.active === 0}>Inactive</option>
          </select>

          <label>New Password (optional)</label>
          <input
            name="new_password"
            type="password"
            placeholder="Leave blank to keep current password"
          />

          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserPage;