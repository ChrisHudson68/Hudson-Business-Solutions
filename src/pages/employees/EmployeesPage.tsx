import type { FC } from 'hono/jsx';

interface EmployeeRow {
  id: number;
  name: string;
  pay_type: string;
  hourly_rate: number | null;
  annual_salary: number | null;
  active: number;
  archived_at?: string | null;
}

interface EmployeesPageProps {
  employees: EmployeeRow[];
  csrfToken: string;
  showArchived?: boolean;
  canCreateEmployees?: boolean;
  canEditEmployees?: boolean;
  canArchiveEmployees?: boolean;
}

function formatMoney(value: number): string {
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
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Employees</h1>
          <p class="muted">Manage pay setup and employee status.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={showArchived ? '/employees' : '/employees?show_archived=1'}>
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </a>
          {canCreateEmployees ? <a class="btn btn-primary" href="/add_employee">Add Employee</a> : null}
        </div>
      </div>

      <div class="card">
        <div class="table-wrap table-wrap-tight">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Pay Type</th>
                <th class="right">Rate / Salary</th>
                <th>Status</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length > 0 ? (
                employees.map((employee) => (
                  <tr>
                    <td>
                      <div><b>{employee.name}</b></div>
                      <div class="muted small">
                        {employee.archived_at ? 'Archived' : employee.active ? 'Active record' : 'Inactive record'}
                      </div>
                    </td>
                    <td>{employee.pay_type}</td>
                    <td class="right">
                      {employee.pay_type === 'Salary'
                        ? `$${formatMoney(Number(employee.annual_salary || 0))}/yr`
                        : `$${formatMoney(Number(employee.hourly_rate || 0))}/hr`}
                    </td>
                    <td>
                      {employee.archived_at ? (
                        <span class="badge badge-warn">Archived</span>
                      ) : employee.active ? (
                        <span class="badge badge-good">Active</span>
                      ) : (
                        <span class="badge">Inactive</span>
                      )}
                    </td>
                    <td class="right">
                      <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                        {canEditEmployees ? <a class="btn" href={`/edit_employee/${employee.id}`}>Edit</a> : null}

                        {canArchiveEmployees ? (
                          employee.archived_at ? (
                            <form method="post" action={`/restore_employee/${employee.id}`} class="inline-form">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit">Restore</button>
                            </form>
                          ) : (
                            <form method="post" action={`/archive_employee/${employee.id}`} class="inline-form">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit">Archive</button>
                            </form>
                          )
                        ) : (
                          <span class="muted">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={5} class="muted">
                    {showArchived ? 'No archived employees found.' : 'No active employees found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div class="muted" style="margin-top:12px;">
          Archived employees are removed from normal operations but preserved for historical records and recovery.
        </div>
      </div>
    </div>
  );
};

export default EmployeesPage;