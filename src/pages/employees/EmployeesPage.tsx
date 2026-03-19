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
  const hasEmployees = employees.length > 0;

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
        {hasEmployees ? (
          <>
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
                  {employees.map((employee) => (
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
                  ))}
                </tbody>
              </table>
            </div>

            <div class="muted" style="margin-top:12px;">
              Archived employees are removed from normal operations but preserved for historical records and recovery.
            </div>
          </>
        ) : (
          <div style="text-align:center; padding:36px 20px;">
            <div style="
              width:64px;
              height:64px;
              margin:0 auto 16px;
              border-radius:16px;
              background:#EFF6FF;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:28px;
              font-weight:900;
              color:#1D4ED8;
            ">
              👷
            </div>

            <h2 style="margin:0 0 10px;">
              {showArchived ? 'No archived employees yet' : 'No employees yet'}
            </h2>

            <p class="muted" style="max-width:520px; margin:0 auto 16px;">
              Employees power timesheets, labor cost tracking, payroll visibility, and job profitability.
              Add your team so you can start recording hours and understanding labor costs by project.
            </p>

            {!showArchived && canCreateEmployees ? (
              <a class="btn btn-primary" href="/add_employee">
                Add Your First Employee
              </a>
            ) : null}

            <div class="muted small" style="margin-top:14px;">
              {showArchived
                ? 'Archived employees will appear here once records are archived.'
                : 'You can edit employee details, rates, and archive records later.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeesPage;