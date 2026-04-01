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
    ? 'border:1px solid var(--navy); background:rgba(30,58,95,0.06);'
    : 'border:1px solid var(--border);';
}

function roleTone(selected: boolean) {
  return selected ? 'badge badge-good' : 'badge';
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

      <div class="card" style="max-width:1040px;">
        {error ? (
          <div
            class="badge badge-bad"
            style="display:block; height:auto; padding:12px 14px; margin-bottom:14px; border-radius:12px;"
          >
            {error}
          </div>
        ) : null}

        <form method="post">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <div class="grid grid-2">
            <div>
              <label>Name</label>
              <input name="name" required value={formData?.name || ''} />
            </div>

            <div>
              <label>Email</label>
              <input name="email" type="email" required value={formData?.email || ''} />
            </div>
          </div>

          <div class="grid grid-2" style="margin-top:12px;">
            <div>
              <label>Role</label>
              <select name="role">
                {rolePresets.map((preset) => (
                  <option value={preset.role} selected={selectedRole === preset.role}>{preset.role}</option>
                ))}
              </select>
              <div class="muted" style="margin-top:8px;">
                Start with a role preset. Individual user overrides can be adjusted later on the edit screen.
              </div>
            </div>

            <div>
              <label>Linked Employee Record</label>
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
              <div class="muted" style="margin-top:8px;">
                Recommended for Employee users so time tracking and account links stay aligned.
              </div>
            </div>
          </div>

          <label>Password</label>
          <input name="password" type="password" required />

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
              <div>
                <h3 style="margin:0;">Role Presets</h3>
                <p class="muted" style="margin:6px 0 0;">
                  Compare the available access presets before creating the user.
                </p>
              </div>
              <span class={roleTone(true)}>Selected: {selectedPreset.label}</span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:14px;">
              {rolePresets.map((preset) => (
                <div class="card" style={`margin:0; box-shadow:none; ${presetCardClass(selectedRole === preset.role)}`}>
                  <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                    <div>
                      <h3 style="margin:0 0 6px 0;">{preset.label}</h3>
                      <p class="muted" style="margin:0;">{preset.description}</p>
                    </div>
                    <span class={roleTone(selectedRole === preset.role)}>{preset.permissionCount}</span>
                  </div>

                  <div style="margin-top:12px; display:grid; gap:8px;">
                    {preset.highlights.map((item) => (
                      <div class="muted">• {item}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--border);">
            <h3 style="margin:0;">Selected Role Preview: {selectedPreset.label}</h3>
            <p class="muted" style="margin:6px 0 0;">
              This user will receive the following base access set when the form is submitted.
            </p>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
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
