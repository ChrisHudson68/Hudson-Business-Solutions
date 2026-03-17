import type { FC } from 'hono/jsx';

interface EmployeeOption {
  id: number;
  name: string;
}

interface AddUserPageProps {
  error?: string;
  formData?: {
    name: string;
    email: string;
    role: string;
    employee_id?: string;
  };
  employeeOptions: EmployeeOption[];
  csrfToken: string;
}

export const AddUserPage: FC<AddUserPageProps> = ({
  error,
  formData,
  employeeOptions,
  csrfToken,
}) => {
  const selectedRole = formData?.role || 'Employee';
  const selectedEmployeeId = formData?.employee_id || '';

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Add User</h1>
          <p>Create a user, assign a role, and optionally link them to an employee record.</p>
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

        <form method="post">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Name</label>
          <input name="name" required value={formData?.name || ''} />

          <label>Email</label>
          <input name="email" type="email" required value={formData?.email || ''} />

          <label>Role</label>
          <select name="role">
            <option value="Admin" selected={selectedRole === 'Admin'}>Admin</option>
            <option value="Manager" selected={selectedRole === 'Manager'}>Manager</option>
            <option value="Employee" selected={selectedRole === 'Employee'}>Employee</option>
          </select>

          <label>Linked Employee Record (recommended for Employee users)</label>
          <select name="employee_id">
            <option value="">-- Not linked --</option>
            {employeeOptions.map((employee) => (
              <option
                value={String(employee.id)}
                selected={selectedEmployeeId === String(employee.id)}
              >
                {employee.name}
              </option>
            ))}
          </select>

          <label>Password</label>
          <input name="password" type="password" required />

          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Create User</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserPage;