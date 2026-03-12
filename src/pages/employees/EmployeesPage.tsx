import type { FC } from 'hono/jsx';

interface Employee {
  id: number;
  name: string;
  pay_type: string;
  hourly_rate: number | null;
  annual_salary: number | null;
  active: number;
}

interface EmployeesPageProps {
  employees: Employee[];
  csrfToken: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const EmployeesPage: FC<EmployeesPageProps> = ({ employees }) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Employees</h1>
          <p>Manage your team and pay rates.</p>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="/add_employee">Add Employee</a>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Pay Type</th>
                <th class="right">Rate</th>
                <th class="right">Status</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length > 0 ? (
                employees.map((e) => (
                  <tr>
                    <td><b>{e.name}</b></td>
                    <td>{e.pay_type}</td>
                    <td class="right">
                      {e.pay_type === 'Hourly'
                        ? `$${formatCurrency(e.hourly_rate || 0)}/hr`
                        : `$${formatCurrency(e.annual_salary || 0)}/yr`}
                    </td>
                    <td class="right">
                      {e.active ? (
                        <span class="badge badge-good">Active</span>
                      ) : (
                        <span class="badge badge-bad">Inactive</span>
                      )}
                    </td>
                    <td class="right">
                      <a class="btn" href={`/edit_employee/${e.id}`}>Edit</a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={5} class="muted">No employees yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeesPage;