import type { FC } from 'hono/jsx';

interface Employee {
  id: number;
  name: string;
  pay_type: string;
  hourly_rate: number | string | null;
  annual_salary: number | string | null;
  active: number;
}

interface EditEmployeePageProps {
  employee: Employee;
  csrfToken: string;
  error?: string;
  success?: string;
}

export const EditEmployeePage: FC<EditEmployeePageProps> = ({
  employee,
  csrfToken,
  error,
  success,
}) => {
  const hourlyRate =
    employee.hourly_rate === null || employee.hourly_rate === undefined
      ? '0'
      : String(employee.hourly_rate);

  const annualSalary =
    employee.annual_salary === null || employee.annual_salary === undefined
      ? '0'
      : String(employee.annual_salary);

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit Employee</h1>
          <p>Update employee details and pay.</p>
        </div>
        <div class="actions">
          <a class="btn" href="/employees">Back</a>
        </div>
      </div>

      <div class="card">
        {error ? (
          <div
            class="badge badge-bad"
            style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            class="badge badge-good"
            style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;"
          >
            {success}
          </div>
        ) : null}

        <form method="post">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Name</label>
          <input name="name" value={employee.name} required />

          <label>Pay Type</label>
          <select name="pay_type">
            <option value="Hourly" selected={employee.pay_type === 'Hourly'}>Hourly</option>
            <option value="Salary" selected={employee.pay_type === 'Salary'}>Salary</option>
          </select>

          <div class="row">
            <div>
              <label>Hourly Rate</label>
              <input name="hourly_rate" type="number" step="0.01" min="0" value={hourlyRate} />
            </div>
            <div>
              <label>Annual Salary</label>
              <input name="annual_salary" type="number" step="0.01" min="0" value={annualSalary} />
            </div>
          </div>

          <label style="margin-top:14px;">Active</label>
          <select name="active">
            <option value="1" selected={!!employee.active}>Active</option>
            <option value="0" selected={!employee.active}>Inactive</option>
          </select>

          <div style="margin-top:16px;" class="actions">
            <button class="btn btn-primary" type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmployeePage;