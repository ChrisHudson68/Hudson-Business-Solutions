import type { FC } from 'hono/jsx';

interface AddEmployeePageProps {
  csrfToken: string;
  error?: string;
  formData?: {
    name?: string;
    pay_type?: string;
    hourly_rate?: string;
    annual_salary?: string;
    lunch_deduction_exempt?: number;
  };
}

function selectedCardStyle(selected: boolean) {
  return selected
    ? 'border:1px solid var(--navy); background:rgba(30,58,95,0.06);'
    : 'border:1px solid var(--border);';
}

export const AddEmployeePage: FC<AddEmployeePageProps> = ({
  csrfToken,
  error,
  formData,
}) => {
  const values = {
    name: formData?.name ?? '',
    pay_type: formData?.pay_type ?? 'Hourly',
    hourly_rate: formData?.hourly_rate ?? '0',
    annual_salary: formData?.annual_salary ?? '0',
    lunch_deduction_exempt: Number(formData?.lunch_deduction_exempt ?? 0),
  };

  const isHourly = values.pay_type === 'Hourly';
  const isSalary = values.pay_type === 'Salary';

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Add Employee</h1>
          <p>Create an employee for timesheets, labor costing, and payroll visibility.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/employees">Back</a>
        </div>
      </div>

      <div class="card" style="max-width:860px;">
        {error ? (
          <div class="card" style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">
            {error}
          </div>
        ) : null}

        <form method="post">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Name</label>
          <input name="name" value={values.name} required />

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
              <input name="hourly_rate" type="number" step="0.01" min="0" value={values.hourly_rate} />
              <div class="muted" style="margin-top:8px;">
                Use for Hourly employees.
              </div>
            </div>
            <div>
              <label>Annual Salary</label>
              <input name="annual_salary" type="number" step="0.01" min="0" value={values.annual_salary} />
              <div class="muted" style="margin-top:8px;">
                Use for Salary employees.
              </div>
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
                checked={values.lunch_deduction_exempt === 1}
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

          <div class="actions actions-mobile-stack" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit">Add Employee</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEmployeePage;
