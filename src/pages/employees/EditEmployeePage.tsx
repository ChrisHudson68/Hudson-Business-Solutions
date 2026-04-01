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

function selectedCardStyle(selected: boolean) {
  return selected
    ? 'border:1px solid var(--navy); background:rgba(30,58,95,0.06);'
    : 'border:1px solid var(--border);';
}

export const EditEmployeePage: FC<EditEmployeePageProps> = ({
  employee,
  error,
  success,
  csrfToken,
  canArchiveEmployees,
}) => {
  const isHourly = employee.pay_type === 'Hourly';
  const isSalary = employee.pay_type === 'Salary';

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Edit Employee</h1>
          <p class="muted">Update employee pay setup, lunch deduction behavior, and status.</p>
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

      <div class="card" style="max-width:860px;">
        <form method="post" action={`/edit_employee/${employee.id}`}>
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Name</label>
          <input name="name" value={employee.name} required />

          <label>Pay Type</label>
          <select name="pay_type">
            <option value="Hourly" selected={isHourly}>Hourly</option>
            <option value="Salary" selected={isSalary}>Salary</option>
          </select>

          <div class="muted" style="margin-top:8px;">
            Choose how this employee should be costed in labor reports and timesheets.
          </div>

          <div
            style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:16px;"
          >
            <div class="card" style={`margin:0; box-shadow:none; ${selectedCardStyle(isHourly)}`}>
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                <div>
                  <h3 style="margin:0 0 6px 0;">Hourly</h3>
                  <p class="muted" style="margin:0;">
                    Best for field labor and staff tracked by hourly cost.
                  </p>
                </div>
                <span class={isHourly ? 'badge badge-good' : 'badge'}>Selected</span>
              </div>
              <div class="muted" style="margin-top:12px;">• Uses hourly rate for labor costing</div>
              <div class="muted" style="margin-top:8px;">• Most common for time-entry based payroll</div>
            </div>

            <div class="card" style={`margin:0; box-shadow:none; ${selectedCardStyle(isSalary)}`}>
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                <div>
                  <h3 style="margin:0 0 6px 0;">Salary</h3>
                  <p class="muted" style="margin:0;">
                    Best for office or management staff with annual salary.
                  </p>
                </div>
                <span class={isSalary ? 'badge badge-good' : 'badge'}>Selected</span>
              </div>
              <div class="muted" style="margin-top:12px;">• Converts annual salary to hourly equivalent</div>
              <div class="muted" style="margin-top:8px;">• Keeps labor reports consistent across the app</div>
            </div>
          </div>

          <div class="grid grid-2" style="margin-top:16px;">
            <div>
              <label>Hourly Rate</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="hourly_rate"
                value={String(employee.hourly_rate ?? 0)}
              />
              <div class="muted" style="margin-top:8px;">Use for Hourly employees.</div>
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
              <div class="muted" style="margin-top:8px;">Use for Salary employees.</div>
            </div>
          </div>

          <div class="card" style="margin-top:16px; box-shadow:none; border:1px solid var(--border);">
            <h3 style="margin:0;">Lunch Deduction</h3>
            <p class="muted" style="margin:6px 0 0;">
              By default, the system deducts 1 hour for lunch on qualifying days. Exempt only employees who should not receive that automatic deduction.
            </p>

            <label style="display:flex; align-items:flex-start; gap:10px; margin-top:14px;">
              <input
                type="checkbox"
                name="lunch_deduction_exempt"
                value="1"
                checked={Number(employee.lunch_deduction_exempt || 0) === 1}
                style="width:auto; margin-top:2px;"
              />
              <span>
                <b>Exempt from automatic 1-hour lunch deduction</b>
                <span class="muted" style="display:block; margin-top:4px;">
                  Use this for employees whose paid hours should not be reduced automatically for lunch.
                </span>
              </span>
            </label>
          </div>

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
