import type { FC } from 'hono/jsx';

interface UsersPageProps {
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    active: number;
    employee_name: string | null;
  }>;
}

export const UsersPage: FC<UsersPageProps> = ({ users }) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Users</h1>
          <p class="muted">Manage tenant users, access roles, and employee links.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn btn-primary" href="/add_user">Add User</a>
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
                    <td>{user.role}</td>
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
                        <a class="btn" href={`/edit_user/${user.id}`}>Edit</a>
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