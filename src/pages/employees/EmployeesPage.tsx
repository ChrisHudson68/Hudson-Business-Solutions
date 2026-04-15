import type { FC } from 'hono/jsx';

interface EmployeeRow {
  id: number;
  name: string;
  pay_type: string;
  hourly_rate: number | null;
  annual_salary: number | null;
  active: number;
  archived_at?: string | null;
  lunch_deduction_exempt?: number;
}

interface EmployeesPageProps {
  employees: EmployeeRow[];
  csrfToken: string;
  showArchived?: boolean;
  canCreateEmployees?: boolean;
  canEditEmployees?: boolean;
  canArchiveEmployees?: boolean;
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const EmployeesPage: FC<EmployeesPageProps> = ({
  employees,
  csrfToken,
  showArchived,
  canCreateEmployees,
  canEditEmployees,
  canArchiveEmployees,
}) => {
  const activeCount = employees.filter((e) => !e.archived_at && e.active === 1).length;
  const inactiveCount = employees.filter((e) => !e.archived_at && e.active !== 1).length;
  const archivedCount = employees.filter((e) => !!e.archived_at).length;
  const lunchExemptCount = employees.filter((e) => Number(e.lunch_deduction_exempt || 0) === 1 && !e.archived_at).length;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Employees</h1>
          <p>Manage pay setup, lunch deduction behavior, and employee status.</p>
        </div>
        <div class="actions">
          <a class="btn" href={showArchived ? '/employees' : '/employees?show_archived=1'}>
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </a>
          {canCreateEmployees ? <a class="btn btn-primary" href="/add_employee">+ Add Employee</a> : null}
        </div>
      </div>

      <div class="stat-grid stat-grid-4" style="margin-bottom:16px;">
        <div class="stat-card stat-card-green">
          <div class="stat-label">Active</div>
          <div class="stat-value">{activeCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Inactive</div>
          <div class="stat-value">{inactiveCount}</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Archived</div>
          <div class="stat-value">{archivedCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Lunch Exempt</div>
          <div class="stat-value">{lunchExemptCount}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>All Employees</h2>
          <span class="badge" style="background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); color:#fff;">
            {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
          </span>
        </div>

        {employees.length > 0 ? (
          <div class="table-wrap" style="margin:0 -18px -16px;">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Pay Type</th>
                  <th class="right">Rate / Salary</th>
                  <th>Lunch</th>
                  <th>Status</th>
                  <th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr>
                    <td>
                      <div style="font-weight:700;">{emp.name}</div>
                      <div class="muted" style="font-size:12px; margin-top:2px;">
                        {emp.archived_at ? 'Archived' : emp.active ? 'Active' : 'Inactive'}
                      </div>
                    </td>
                    <td>{emp.pay_type}</td>
                    <td class="right" style="font-weight:700;">
                      {emp.pay_type === 'Salary'
                        ? `$${fmt(Number(emp.annual_salary || 0))}/yr`
                        : `$${fmt(Number(emp.hourly_rate || 0))}/hr`}
                    </td>
                    <td>
                      {Number(emp.lunch_deduction_exempt || 0) === 1
                        ? <span class="badge badge-warn">Exempt</span>
                        : <span class="badge badge-good">Auto Deduct</span>}
                    </td>
                    <td>
                      {emp.archived_at
                        ? <span class="badge badge-warn">Archived</span>
                        : emp.active
                          ? <span class="badge badge-good">Active</span>
                          : <span class="badge">Inactive</span>}
                    </td>
                    <td class="right">
                      <div class="actions" style="justify-content:flex-end; gap:6px;">
                        {canEditEmployees ? <a class="btn btn-sm" href={`/edit_employee/${emp.id}`}>Edit</a> : null}
                        {canArchiveEmployees ? (
                          emp.archived_at ? (
                            <form method="post" action={`/restore_employee/${emp.id}`} style="display:inline;">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn btn-sm" type="submit">Restore</button>
                            </form>
                          ) : (
                            <form method="post" action={`/archive_employee/${emp.id}`} style="display:inline;">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn btn-sm" type="submit">Archive</button>
                            </form>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="empty-state">
            <div class="empty-state-icon">👥</div>
            <h3>{showArchived ? 'No archived employees' : 'No employees yet'}</h3>
            <p>
              {showArchived
                ? 'Archived employees will appear here.'
                : 'Add your team to start tracking hours, labor costs, and project profitability.'}
            </p>
            {!showArchived && canCreateEmployees ? (
              <a class="btn btn-primary" href="/add_employee">+ Add Your First Employee</a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeesPage;
