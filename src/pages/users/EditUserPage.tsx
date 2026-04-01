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
    ? 'border:1px solid var(--navy); background:rgba(30,58,95,0.06);'
    : 'border:1px solid var(--border);';
}

function resolvePermissionSource(
  permission: PermissionKey,
  rolePermissions: PermissionKey[],
  overrideSelections: Partial<Record<PermissionKey, PermissionOverrideValue>>,
) {
  const override = overrideSelections[permission] ?? 'default';

  if (override === 'allow') {
    return {
      label: 'Explicitly allowed for this user',
      badgeClass: 'badge badge-good',
      modeLabel: 'Allow',
    };
  }

  if (override === 'deny') {
    return {
      label: 'Explicitly denied for this user',
      badgeClass: 'badge badge-bad',
      modeLabel: 'Deny',
    };
  }

  return rolePermissions.includes(permission)
    ? {
        label: 'Inherited from selected role',
        badgeClass: 'badge',
        modeLabel: 'Default',
      }
    : {
        label: 'Not granted by selected role',
        badgeClass: 'badge',
        modeLabel: 'Default',
      };
}

function countSelections(
  overrides: Partial<Record<PermissionKey, PermissionOverrideValue>>,
  permissions: readonly PermissionKey[],
  expected: PermissionOverrideValue,
): number {
  return permissions.filter((permission) => (overrides[permission] ?? 'default') === expected).length;
}

function groupedPermissionsCount(
  permissions: PermissionKey[],
  groupPermissions: PermissionKey[],
): number {
  return groupPermissions.filter((permission) => permissions.includes(permission)).length;
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

  const explicitAllows = countSelections(selectedOverrides, PERMISSIONS, 'allow');
  const explicitDenies = countSelections(selectedOverrides, PERMISSIONS, 'deny');

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit User</h1>
          <p class="muted">
            Update user info, role preset, employee link, account status, and user-specific permissions.
          </p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/users/permissions">View Role Permissions</a>
          <a class="btn" href="/users">Back</a>
        </div>
      </div>

      <div class="card" style="max-width:1140px;">
        {error ? (
          <div
            class="badge badge-bad"
            style="display:block; height:auto; padding:12px 14px; margin-bottom:14px; border-radius:12px;"
          >
            {error}
          </div>
        ) : null}

        <form method="post" action={`/edit_user/${user.id}`}>
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <div class="grid grid-2">
            <div>
              <label>Name</label>
              <input name="name" value={values.name} required />
            </div>

            <div>
              <label>Email</label>
              <input name="email" type="email" value={values.email} required />
            </div>
          </div>

          <div class="grid grid-2" style="margin-top:12px;">
            <div>
              <label>Role</label>
              <select name="role">
                {rolePresets.map((preset) => (
                  <option value={preset.role} selected={values.role === preset.role}>{preset.role}</option>
                ))}
              </select>
              <div class="muted" style="margin-top:8px;">
                Changing the role changes the base permission set first. User-specific overrides below fine tune access.
              </div>
            </div>

            <div>
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
              <div class="muted" style="margin-top:8px;">
                Link the account when this user should be tied to an employee profile for timesheets or field access.
              </div>
            </div>
          </div>

          <div class="grid grid-2" style="margin-top:12px;">
            <div>
              <label>Active</label>
              <select name="active">
                <option value="1" selected={values.active === 1}>Active</option>
                <option value="0" selected={values.active === 0}>Inactive</option>
              </select>
            </div>

            <div>
              <label>New Password (optional)</label>
              <input
                name="new_password"
                type="password"
                placeholder="Leave blank to keep current password"
              />
            </div>
          </div>

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
              <div>
                <h3 style="margin:0;">Role Presets</h3>
                <p class="muted" style="margin:6px 0 0;">
                  Compare the built-in access patterns before applying individual overrides.
                </p>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                <span class="badge">Role Perms: {selectedPreset.permissionCount}</span>
                <span class="badge badge-good">Effective: {selectedEffectivePermissions.length}</span>
                <span class="badge">Allows: {explicitAllows}</span>
                <span class="badge badge-bad">Denies: {explicitDenies}</span>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:14px;">
              {rolePresets.map((preset) => (
                <div class="card" style={`margin:0; box-shadow:none; ${presetCardClass(values.role === preset.role)}`}>
                  <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                    <div>
                      <h3 style="margin:0 0 6px 0;">{preset.label}</h3>
                      <p class="muted" style="margin:0;">{preset.description}</p>
                    </div>
                    <span class={values.role === preset.role ? 'badge badge-good' : 'badge'}>
                      {preset.permissionCount}
                    </span>
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
              These are the base permissions from the selected role before any user-specific overrides are applied.
            </p>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
              {selectedPreset.permissions.map((permission) => (
                <span class="badge">{permission}</span>
              ))}
            </div>
          </div>

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
              <div>
                <h3 style="margin:0;">User-Specific Permission Overrides</h3>
                <p class="muted" style="margin:6px 0 0;">
                  Default inherits the selected role. Allow grants access even if the role does not. Deny blocks access even if the role allows it.
                </p>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                <span class="badge">Default = Role</span>
                <span class="badge badge-good">Allow = Grant</span>
                <span class="badge badge-bad">Deny = Block</span>
              </div>
            </div>

            {canCustomizeUserPermissions(values.role) ? (
              <div style="display:grid; gap:16px; margin-top:14px;">
                {permissionGroups.map((group) => (
                  <div class="card" style="margin:0; box-shadow:none; border:1px solid var(--border);">
                    <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                      <div>
                        <h4 style="margin:0;">{group.label}</h4>
                        <div class="muted" style="margin-top:6px;">
                          Effective in this group: {groupedPermissionsCount(selectedEffectivePermissions, group.permissions)} / {group.permissions.length}
                        </div>
                      </div>
                    </div>

                    <div style="display:grid; gap:10px; margin-top:12px;">
                      {group.permissions.map((permission, index) => {
                        const source = resolvePermissionSource(permission, selectedPreset.permissions, selectedOverrides);
                        const currentSelection = selectedOverrides[permission] ?? 'default';

                        return (
                          <div
                            style={`display:grid; grid-template-columns:minmax(0, 1fr) 220px; gap:12px; align-items:center; ${
                              index > 0 ? 'border-top:1px solid var(--border); padding-top:10px;' : ''
                            }`}
                          >
                            <div>
                              <div style="font-weight:700;">{formatPermissionLabel(permission)}</div>
                              <div class="muted" style="margin-top:4px;">Key: {permission}</div>
                              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
                                <span class={source.badgeClass}>{source.label}</span>
                                <span class="badge">Current Mode: {source.modeLabel}</span>
                              </div>
                            </div>

                            <div>
                              <select name={`permission_override_${permission}`}>
                                <option value="default" selected={currentSelection === 'default'}>
                                  Default (Use Role)
                                </option>
                                <option value="allow" selected={currentSelection === 'allow'}>
                                  Allow (Grant Access)
                                </option>
                                <option value="deny" selected={currentSelection === 'deny'}>
                                  Deny (Block Access)
                                </option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style="margin-top:14px;">
                <p class="muted">
                  User-specific overrides are disabled for Admin users in this phase so tenant owners cannot accidentally lock themselves out.
                  Admins still retain full server-side access. Manager and Employee accounts can be fine tuned here.
                </p>
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                  {selectedPreset.permissions.map((permission) => (
                    <span class="badge">{permission}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--border);">
            <h3 style="margin:0;">Effective Access Preview</h3>
            <p class="muted" style="margin:6px 0 0;">
              These are the permissions this user will have after role defaults and per-user overrides are resolved.
            </p>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
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
