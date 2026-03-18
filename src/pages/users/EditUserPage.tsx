import type { FC } from 'hono/jsx';
import type { PermissionKey, UserRole } from '../../services/permissions.js';

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

interface RolePreset {
  role: UserRole;
  label: string;
  description: string;
  permissionCount: number;
  permissions: PermissionKey[];
  highlights: string[];
}

interface EditUserPageProps {
  user: UserRecord;
  employeeOptions: EmployeeOption[];
  rolePresets: RolePreset[];
  formData?: EditUserFormData;
  error?: string;
  csrfToken: string;
}

function presetCardClass(selected: boolean) {
  return selected
    ? 'border:1px solid var(--brand); background:rgba(20,93,160,0.06);'
    : 'border:1px solid var(--line);';
}

export const EditUserPage: FC<EditUserPageProps> = ({
  user,
  employeeOptions,
  rolePresets,
  formData,
  error,
  csrfToken,
}) => {
  const values = {
    name: formData?.name ?? user.name,
    email: formData?.email ?? user.email,
    role: (formData?.role ?? user.role) as UserRole,
    active: formData?.active ?? user.active,
    employee_id: formData?.employee_id ?? String(user.employee_id ?? ''),
  };

  const selectedPreset = rolePresets.find((preset) => preset.role === values.role) || rolePresets[0];

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit User</h1>
          <p class="muted">Update user info, role preset, employee link, or deactivate access.</p>
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

        <form method="post" action={`/edit_user/${user.id}`}>
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Name</label>
          <input name="name" value={values.name} required />

          <label>Email</label>
          <input name="email" type="email" value={values.email} required />

          <label>Role</label>
          <select name="role">
            {rolePresets.map((preset) => (
              <option value={preset.role} selected={values.role === preset.role}>{preset.role}</option>
            ))}
          </select>

          <div class="muted" style="margin:8px 0 14px 0;">Changing a role changes the full permission preset assigned to this user.</div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:16px;">
            {rolePresets.map((preset) => (
              <div class="card" style={`margin:0; box-shadow:none; ${presetCardClass(values.role === preset.role)}`}>
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

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--line);">
            <h3 style="margin-top:0;">Selected Role Preview: {selectedPreset.label}</h3>
            <p class="muted">Saving this user will assign the following permission preset.</p>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              {selectedPreset.permissions.map((permission) => (
                <span class="badge">{permission}</span>
              ))}
            </div>
          </div>

          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserPage;
