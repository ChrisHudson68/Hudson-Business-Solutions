import type { FC } from 'hono/jsx';
import type { UserRole } from '../../services/permissions.js';

interface UsersPageProps {
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    active: number;
    employee_name: string | null;
  }>;
  canCreateUsers?: boolean;
  canEditUsers?: boolean;
  canManagePermissions?: boolean;
  rolePresets: Array<{
    role: UserRole;
    label: string;
    description: string;
    permissionCount: number;
    highlights: string[];
    customized?: boolean;
  }>;
}

function countUsersByRole(users: UsersPageProps['users'], role: UserRole) {
  return users.filter((user) => user.role === role).length;
}

export const UsersPage: FC<UsersPageProps> = ({
  users,
  canCreateUsers,
  canEditUsers,
  canManagePermissions,
  rolePresets,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Users</h1>
          <p class="muted">Manage tenant users, access roles, employee links, and role permissions.</p>
        </div>
        <div class="actions actions-mobile-stack">
          {canManagePermissions ? <a class="btn" href="/users/permissions">Permissions</a> : null}
          {canCreateUsers ? <a class="btn btn-primary" href="/add_user">Add User</a> : null}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h2 style="margin-top:0;">Role Presets</h2>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          {rolePresets.map((preset) => (
            <div class="card" style="margin:0; box-shadow:none; border:1px solid var(--line);">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                <div>
                  <h3 style="margin:0 0 6px 0;">{preset.label}</h3>
                  <p class="muted" style="margin:0;">{preset.description}</p>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                  <span class="badge">{preset.permissionCount} perms</span>
                  {preset.customized ? <span class="badge">Custom</span> : null}
                </div>
              </div>
              <div class="muted" style="margin-top:8px;">Users assigned: {countUsersByRole(users, preset.role)}</div>
              <div style="margin-top:12px; display:grid; gap:8px;">
                {preset.highlights.slice(0, 2).map((item) => (
                  <div class="muted">• {item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div class="card">
        <div class="table-wrap table-wrap-tight">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Employee Link</th>
                <th>Status</th>
                <th class="right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <tr>
                    <td>
                      <div><b>{user.name}</b></div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <div style="display:flex; flex-direction:column; gap:4px;">
                        <span>{user.role}</span>
                        <span class="muted" style="font-size:12px;">{rolePresets.find((preset) => preset.role === user.role)?.permissionCount || 0} permissions</span>
                      </div>
                    </td>
                    <td>{user.employee_name || <span class="muted">Not linked</span>}</td>
                    <td>
                      {user.active ? (
                        <span class="badge badge-good">Active</span>
                      ) : (
                        <span class="badge badge-bad">Inactive</span>
                      )}
                    </td>
                    <td class="right">
                      <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                        {canEditUsers ? <a class="btn" href={`/edit_user/${user.id}`}>Edit</a> : <span class="muted">View only</span>}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={6} class="muted">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
