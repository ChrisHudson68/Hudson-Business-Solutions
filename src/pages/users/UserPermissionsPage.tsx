import type { FC } from 'hono/jsx';
import type { PermissionKey, UserRole } from '../../services/permissions.js';

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
}

interface UserPermissionsPageProps {
  rolePresets: RolePreset[];
  permissionGroups: PermissionGroup[];
  canCreateUsers?: boolean;
}

function prettyPermission(permission: string): string {
  return permission
    .replace(/\./g, ' • ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export const UserPermissionsPage: FC<UserPermissionsPageProps> = ({
  rolePresets,
  permissionGroups,
  canCreateUsers,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Role Permissions</h1>
          <p class="muted">HBS currently uses locked role presets. Tenant admins assign access by choosing a role for each user.</p>
        </div>
        <div class="actions actions-mobile-stack">
          {canCreateUsers ? <a class="btn btn-primary" href="/add_user">Add User</a> : null}
          <a class="btn" href="/users">Back to Users</a>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          {rolePresets.map((preset) => (
            <div class="card" style="margin:0; box-shadow:none; border:1px solid var(--line);">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                <div>
                  <h3 style="margin:0 0 6px 0;">{preset.label}</h3>
                  <p class="muted" style="margin:0;">{preset.description}</p>
                </div>
                <span class="badge">{preset.permissionCount} perms</span>
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

      <div class="card">
        <h2 style="margin-top:0;">Permission Matrix</h2>
        <p class="muted" style="margin-top:0;">Use this as the source of truth when deciding which role a new or existing user should have.</p>

        <div class="table-wrap table-wrap-tight">
          <table class="table">
            <thead>
              <tr>
                <th>Permission</th>
                {rolePresets.map((preset) => (
                  <th>{preset.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissionGroups.map((group) => (
                <>
                  <tr>
                    <td colspan={rolePresets.length + 1}>
                      <b>{group.label}</b>
                    </td>
                  </tr>
                  {group.permissions.map((permission) => (
                    <tr>
                      <td>{prettyPermission(permission)}</td>
                      {rolePresets.map((preset) => {
                        const allowed = preset.permissions.includes(permission);
                        return (
                          <td>
                            {allowed ? (
                              <span class="badge badge-good">Allowed</span>
                            ) : (
                              <span class="muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserPermissionsPage;
