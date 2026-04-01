import type { FC } from 'hono/jsx';
import type { PermissionKey, UserRole } from '../../services/permissions.js';
import { CONFIGURABLE_ROLES, formatPermissionLabel } from '../../services/permissions.js';

interface PermissionGroup {
  label: string;
  permissions: PermissionKey[];
}

interface RolePreset {
  role: UserRole;
  label: string;
  description: string;
  permissionCount: number;
  permissions: PermissionKey[];
  highlights: string[];
  customized: boolean;
}

interface UserPermissionsPageProps {
  rolePresets: RolePreset[];
  permissionGroups: PermissionGroup[];
  csrfToken: string;
  notice?: { type: 'success' | 'error'; text: string } | null;
}

function isAllowed(rolePreset: RolePreset | undefined, permission: PermissionKey): boolean {
  return !!rolePreset?.permissions.includes(permission);
}

export const UserPermissionsPage: FC<UserPermissionsPageProps> = ({
  rolePresets,
  permissionGroups,
  csrfToken,
  notice,
}) => {
  const presetByRole = new Map(rolePresets.map((preset) => [preset.role, preset]));

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Role Permissions</h1>
          <p class="muted">
            Admins can customize the Manager and Employee role permissions for this tenant without editing code.
          </p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/users">Back to Users</a>
        </div>
      </div>

      {notice ? (
        <div
          class="card"
          style={`margin-bottom:16px; border-color:${notice.type === 'error' ? '#fecaca' : '#bbf7d0'}; background:${notice.type === 'error' ? '#fef2f2' : '#f0fdf4'};`}
        >
          <b>{notice.type === 'error' ? 'Unable to save changes' : 'Permissions updated'}</b>
          <div class="muted" style="margin-top:6px; color:inherit;">{notice.text}</div>
        </div>
      ) : null}

      <div class="card" style="margin-bottom:16px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          {rolePresets.map((preset) => (
            <div class="card" style="margin:0; box-shadow:none; border:1px solid var(--border);">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                <div>
                  <h3 style="margin:0 0 6px 0;">{preset.label}</h3>
                  <p class="muted" style="margin:0;">{preset.description}</p>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                  <span class="badge">{preset.permissionCount} perms</span>
                  {preset.role === 'Admin' ? (
                    <span class="badge badge-good">Locked</span>
                  ) : preset.customized ? (
                    <span class="badge">Custom</span>
                  ) : (
                    <span class="badge badge-good">Default</span>
                  )}
                </div>
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

      <form method="post" action="/users/permissions">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <input type="hidden" name="action" value="save" />

        <div class="card">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:14px;">
            <div>
              <h2 style="margin:0;">Permission Matrix</h2>
              <p class="muted" style="margin:6px 0 0;">
                Admin always keeps full access. Manager and Employee permissions can be changed below.
              </p>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              <span class="badge badge-good">Admin = always allowed</span>
              <button class="btn btn-primary" type="submit">Save Permission Changes</button>
            </div>
          </div>

          <div class="table-wrap table-wrap-tight">
            <table class="table">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Admin</th>
                  {CONFIGURABLE_ROLES.map((role) => (
                    <th>{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionGroups.map((group) => [
                  (
                    <tr key={`group-${group.label}`}>
                      <td colSpan={CONFIGURABLE_ROLES.length + 2}>
                        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
                          <b>{group.label}</b>
                          <span class="badge">{group.permissions.length} permissions</span>
                        </div>
                      </td>
                    </tr>
                  ),
                  ...group.permissions.map((permission) => (
                    <tr key={permission}>
                      <td>
                        <div style="font-weight:600;">{formatPermissionLabel(permission)}</div>
                        <div class="muted" style="margin-top:4px; font-size:12px;">{permission}</div>
                      </td>
                      <td>
                        <span class="badge badge-good">Allowed</span>
                      </td>
                      {CONFIGURABLE_ROLES.map((role) => {
                        const preset = presetByRole.get(role);
                        const checked = isAllowed(preset, permission);
                        return (
                          <td key={`${role}-${permission}`}>
                            <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;">
                              <input
                                type="checkbox"
                                name={`perm_${role}_${permission}`}
                                value="1"
                                checked={checked}
                              />
                              <span class="muted">Allowed</span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </div>
      </form>

      <div class="card" style="margin-top:16px;">
        <h2 style="margin:0;">Reset to Defaults</h2>
        <p class="muted" style="margin:6px 0 0;">
          Need to undo a custom role setup? Reset a role back to the built-in defaults.
        </p>
        <div class="actions actions-mobile-stack" style="margin-top:14px;">
          {CONFIGURABLE_ROLES.map((role) => (
            <form method="post" action="/users/permissions" style="margin:0;">
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="action" value="reset" />
              <input type="hidden" name="role" value={role} />
              <button class="btn" type="submit">Reset {role} to Default</button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserPermissionsPage;
