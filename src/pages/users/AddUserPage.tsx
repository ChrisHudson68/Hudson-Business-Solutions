import type { FC } from 'hono/jsx';
import type { PermissionKey, UserRole } from '../../services/permissions.js';

interface EmployeeOption {
  id: number;
  name: string;
}

interface RolePreset {
  role: UserRole;
  label: string;
  description: string;
  permissionCount: number;
  permissions: PermissionKey[];
  highlights: string[];
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
  rolePresets: RolePreset[];
  csrfToken: string;
}

function presetCardClass(selected: boolean) {
  return selected
    ? 'border:1px solid var(--brand); background:rgba(20,93,160,0.06);'
    : 'border:1px solid var(--line);';
}

export const AddUserPage: FC<AddUserPageProps> = ({
  error,
  formData,
  employeeOptions,
  rolePresets,
  csrfToken,
}) => {
  const selectedRole = (formData?.role || 'Employee') as UserRole;
  const selectedEmployeeId = formData?.employee_id || '';
  const selectedPreset = rolePresets.find((preset) => preset.role === selectedRole) || rolePresets[0];

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Add User</h1>
          <p>Create a user, assign a role preset, and optionally link them to an employee record.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/users/permissions">View Role Permissions</a>
          <a class="btn" href="/users">Back</a>
        </div>
      </div>

      <div class="card" style="max-width:980px;">
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
            {rolePresets.map((preset) => (
              <option value={preset.role} selected={selectedRole === preset.role}>{preset.role}</option>
            ))}
          </select>

          <div class="muted" style="margin:8px 0 14px 0;">Choose a role preset. HBS permissions are currently managed by role rather than one-off custom toggles.</div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:16px;">
            {rolePresets.map((preset) => (
              <div class="card" style={`margin:0; box-shadow:none; ${presetCardClass(selectedRole === preset.role)}`}>
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                  <div>
                    <h3 style="margin:0 0 6px 0;">{preset.label}</h3>
                    <p class="muted" style="margin:0;">{preset.description}</p>
                  </div>
                  <span class="badge">{preset.permissionCount}</span>
                </div>
                <div style="margin-top:12px; display:grid; gap:8px;">
                  {preset.highlights.map((item) => (
                    <div class="muted">• {item}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

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

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--line);">
            <h3 style="margin-top:0;">Selected Role Preview: {selectedPreset.label}</h3>
            <p class="muted">This user will receive the following access set when the form is submitted.</p>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              {selectedPreset.permissions.map((permission) => (
                <span class="badge">{permission}</span>
              ))}
            </div>
          </div>

          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Create User</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserPage;
