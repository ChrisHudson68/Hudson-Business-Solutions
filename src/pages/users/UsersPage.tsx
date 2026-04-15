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
  return users.filter((u) => u.role === role).length;
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
          <p>Manage workspace users, access roles, employee links, and permissions.</p>
        </div>
        <div class="actions">
          {canManagePermissions ? <a class="btn" href="/users/permissions">Permissions</a> : null}
          {canCreateUsers ? <a class="btn btn-primary" href="/add_user">+ Add User</a> : null}
        </div>
      </div>

      {/* Role overview */}
      <div class="card" style="margin-bottom:16px;">
        <div class="card-head">
          <div>
            <h2>Role Presets</h2>
            <p>Active role setup for this workspace.</p>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
              {users.length} users
            </span>
            <span class="badge badge-good">{users.filter((u) => u.active).length} active</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          {rolePresets.map((preset) => (
            <div style="padding:14px; border-radius:10px; border:1px solid var(--border); background:#FAFCFF;">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; margin-bottom:8px;">
                <div>
                  <div style="font-weight:800; font-size:14px; color:var(--text);">{preset.label}</div>
                  <div class="muted" style="font-size:12px; margin-top:3px;">{preset.description}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex:0 0 auto;">
                  <span class="badge">{preset.permissionCount} perms</span>
                  <span class={preset.customized ? 'badge badge-warn' : 'badge badge-good'} style="font-size:10px;">
                    {preset.customized ? 'Custom' : 'Default'}
                  </span>
                </div>
              </div>
              <div class="muted" style="font-size:12px; margin-bottom:8px;">
                {countUsersByRole(users, preset.role)} user{countUsersByRole(users, preset.role) === 1 ? '' : 's'} assigned
              </div>
              <div style="display:grid; gap:4px;">
                {preset.highlights.slice(0, 2).map((item) => (
                  <div class="muted" style="font-size:12px;">· {item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div class="card">
        <div class="card-head">
          <h2>All Users</h2>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
        </div>

        {users.length > 0 ? (
          <div class="table-wrap" style="margin:0 -18px -16px;">
            <table>
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
                {users.map((user) => (
                  <tr>
                    <td style="font-weight:700;">{user.name}</td>
                    <td class="muted" style="font-size:13px;">{user.email}</td>
                    <td>
                      <div style="font-weight:600;">{user.role}</div>
                      <div class="muted" style="font-size:11px; margin-top:2px;">
                        {rolePresets.find((p) => p.role === user.role)?.permissionCount || 0} permissions
                      </div>
                    </td>
                    <td>{user.employee_name || <span class="muted">—</span>}</td>
                    <td>
                      {user.active
                        ? <span class="badge badge-good">Active</span>
                        : <span class="badge badge-bad">Inactive</span>}
                    </td>
                    <td class="right">
                      {canEditUsers
                        ? <a class="btn btn-sm" href={`/edit_user/${user.id}`}>Edit</a>
                        : <span class="muted" style="font-size:12px;">View only</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="empty-state">
            <div class="empty-state-icon">👤</div>
            <h3>No users yet</h3>
            <p>Add users to give your team access to this workspace.</p>
            {canCreateUsers ? <a class="btn btn-primary" href="/add_user">+ Add User</a> : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
