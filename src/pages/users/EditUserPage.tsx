import type { FC } from 'hono/jsx';
import type { PermissionKey, PermissionOverrideValue, UserRole } from '../../services/permissions.js';
import { PERMISSIONS, canCustomizeUserPermissions, formatPermissionLabel } from '../../services/permissions.js';

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
  permissionOverrides?: Partial<Record<PermissionKey, PermissionOverrideValue>>;
}

interface RolePreset {
  role: UserRole;
  label: string;
  description: string;
  permissionCount: number;
  permissions: PermissionKey[];
  highlights: string[];
}

interface PermissionGroup {
  label: string;
  permissions: PermissionKey[];
}

interface EditUserPageProps {
  user: UserRecord;
  employeeOptions: EmployeeOption[];
  rolePresets: RolePreset[];
  permissionGroups: PermissionGroup[];
  effectivePermissions: PermissionKey[];
  rolePermissions: PermissionKey[];
  overrideSelections: Partial<Record<PermissionKey, PermissionOverrideValue>>;
  formData?: EditUserFormData;
  error?: string;
  csrfToken: string;
}

function presetCardClass(selected: boolean) {
  return selected
    ? 'border:1px solid var(--brand); background:rgba(20,93,160,0.06);'
    : 'border:1px solid var(--line);';
}

function resolvePermissionSource(
  permission: PermissionKey,
  rolePermissions: PermissionKey[],
  overrideSelections: Partial<Record<PermissionKey, PermissionOverrideValue>>,
) {
  const override = overrideSelections[permission] ?? 'default';
  if (override === 'allow') {
    return { label: 'User Override: Allowed', badgeClass: 'badge badge-good' };
  }
  if (override === 'deny') {
    return { label: 'User Override: Denied', badgeClass: 'badge badge-bad' };
  }
  return rolePermissions.includes(permission)
    ? { label: 'Inherited from Role: Allowed', badgeClass: 'badge' }
    : { label: 'Inherited from Role: Denied', badgeClass: 'badge' };
}

export const EditUserPage: FC<EditUserPageProps> = ({
  user,
  employeeOptions,
  rolePresets,
  permissionGroups,
  effectivePermissions,
  rolePermissions,
  overrideSelections,
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
  const selectedOverrides = formData?.permissionOverrides ?? overrideSelections;
  const selectedEffectivePermissions = canCustomizeUserPermissions(values.role)
    ? (PERMISSIONS.filter((permission) => {
        const override = selectedOverrides[permission] ?? 'default';
        if (override === 'deny') return false;
        if (override === 'allow') return true;
        return selectedPreset.permissions.includes(permission);
      }) as PermissionKey[])
    : selectedPreset.permissions;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit User</h1>
          <p class="muted">Update user info, role preset, employee link, deactivation, and user-specific permissions.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/users/permissions">View Role Permissions</a>
          <a class="btn" href="/users">Back</a>
        </div>
      </div>

      <div class="card" style="max-width:1100px;">
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

          <div class="muted" style="margin:8px 0 14px 0;">Changing a role changes the default permission preset assigned to this user. User-specific overrides below fine tune access without weakening server-side security.</div>

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
            <p class="muted">These are the base permissions from the selected role before any user-specific overrides are applied.</p>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              {selectedPreset.permissions.map((permission) => (
                <span class="badge">{permission}</span>
              ))}
            </div>
          </div>

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--line);">
            <h3 style="margin-top:0;">User-Specific Permission Overrides</h3>
            {canCustomizeUserPermissions(values.role) ? (
              <>
                <p class="muted">Use Default / Allow / Deny to fine tune this individual user. Route protection remains enforced server-side, so hidden navigation is not the only control.</p>
                <div style="display:grid; gap:16px;">
                  {permissionGroups.map((group) => (
                    <div class="card" style="margin:0; box-shadow:none; border:1px solid var(--line);">
                      <h4 style="margin-top:0; margin-bottom:12px;">{group.label}</h4>
                      <div style="display:grid; gap:10px;">
                        {group.permissions.map((permission) => {
                          const source = resolvePermissionSource(permission, selectedPreset.permissions, selectedOverrides);
                          const currentSelection = selectedOverrides[permission] ?? 'default';
                          return (
                            <div style="display:grid; grid-template-columns:minmax(0, 1fr) 160px; gap:12px; align-items:center; border-top:1px solid var(--line); padding-top:10px;">
                              <div>
                                <div style="font-weight:600;">{formatPermissionLabel(permission)}</div>
                                <div class="muted" style="margin-top:4px;">Key: {permission}</div>
                                <div style="margin-top:6px;">
                                  <span class={source.badgeClass}>{source.label}</span>
                                </div>
                              </div>
                              <div>
                                <select name={`permission_override_${permission}`}>
                                  <option value="default" selected={currentSelection === 'default'}>Default</option>
                                  <option value="allow" selected={currentSelection === 'allow'}>Allow</option>
                                  <option value="deny" selected={currentSelection === 'deny'}>Deny</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p class="muted">User-specific overrides are disabled for Admin users in this first phase so tenant owners cannot accidentally lock themselves out. Admins still retain full server-side access. Manager and Employee accounts can be fine tuned here.</p>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                  {selectedPreset.permissions.map((permission) => (
                    <span class="badge">{permission}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--line);">
            <h3 style="margin-top:0;">Effective Access Preview</h3>
            <p class="muted">These are the permissions this user will have after role defaults and per-user overrides are resolved.</p>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              {selectedEffectivePermissions.length > 0 ? selectedEffectivePermissions.map((permission) => (
                <span class="badge badge-good">{permission}</span>
              )) : <span class="muted">No effective permissions selected.</span>}
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
