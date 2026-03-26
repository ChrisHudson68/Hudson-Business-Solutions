import type { FC } from 'hono/jsx';

interface EmployeeRecord {
  id: number;
  name: string;
  pay_type: string;
  hourly_rate: number | null;
  annual_salary: number | null;
  active: number;
  lunch_deduction_exempt?: number;
  archived_at?: string | null;
}

interface EditEmployeePageProps {
  employee: EmployeeRecord;
  error?: string;
  success?: string;
  csrfToken: string;
  canArchiveEmployees?: boolean;
}

export const EditEmployeePage: FC<EditEmployeePageProps> = ({
  employee,
  error,
  success,
  csrfToken,
  canArchiveEmployees,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit Employee</h1>
          <p class="muted">Update employee pay setup and status.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/employees">Back</a>

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
          ) : null}
        </div>
      </div>

      {employee.archived_at ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FDE68A; background:#FFFBEB; color:#92400E;"
        >
          This employee is archived. Historical records remain intact, and you can restore this employee at any time.
        </div>
      ) : null}

      {error ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          class="card"
          style="margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;"
        >
          {success}
        </div>
      ) : null}

      <div class="card" style="max-width:760px;">
        <form method="post" action={`/edit_employee/${employee.id}`}>
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
              <input
                type="number"
                step="0.01"
                min="0"
                name="hourly_rate"
                value={String(employee.hourly_rate ?? 0)}
              />
            </div>

            <div>
              <label>Annual Salary</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="annual_salary"
                value={String(employee.annual_salary ?? 0)}
              />
            </div>
          </div>

          <label style="display:flex; align-items:center; gap:10px; margin-top:14px;">
            <input
              type="checkbox"
              name="lunch_deduction_exempt"
              value="1"
              checked={Number(employee.lunch_deduction_exempt || 0) === 1}
            />
            Exempt from automatic 1-hour lunch deduction
          </label>

          <label>Status</label>
          <select name="active">
            <option value="1" selected={employee.active === 1}>Active</option>
            <option value="0" selected={employee.active === 0}>Inactive</option>
          </select>

          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmployeePage;
