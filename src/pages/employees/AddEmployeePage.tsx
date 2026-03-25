import type { FC } from 'hono/jsx';

interface AddEmployeePageProps {
  csrfToken: string;
  error?: string;
  formData?: {
    name?: string;
    pay_type?: string;
    hourly_rate?: string;
    annual_salary?: string;
    lunch_deduction_exempt?: string;
  };
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
    lunch_deduction_exempt: formData?.lunch_deduction_exempt ?? '0',
  };

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Add Employee</h1>
          <p>Create an employee for timesheets and labor cost.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href="/employees">Back</a>
        </div>
      </div>

      <div class="card" style="max-width:760px;">
        {error ? (
          <div
            class="badge badge-bad"
            style="height:auto; padding:10px 12px; margin-bottom:14px; border-radius:12px;"
          >
            {error}
          </div>
        ) : null}

        <form method="post">
          <input type="hidden" name="csrf_token" value={csrfToken} />

          <label>Name</label>
          <input name="name" value={values.name} required />

          <label>Pay Type</label>
          <select name="pay_type">
            <option value="Hourly" selected={values.pay_type === 'Hourly'}>Hourly</option>
            <option value="Salary" selected={values.pay_type === 'Salary'}>Salary</option>
          </select>

          <div class="row">
            <div>
              <label>Hourly Rate</label>
              <input name="hourly_rate" type="number" step="0.01" min="0" value={values.hourly_rate} />
            </div>
            <div>
              <label>Annual Salary</label>
              <input name="annual_salary" type="number" step="0.01" min="0" value={values.annual_salary} />
            </div>
          </div>

          <label style="margin-top:14px;">Lunch Deduction</label>
          <label style="display:flex; align-items:center; gap:10px; margin-top:8px;">
            <input
              type="checkbox"
              name="lunch_deduction_exempt"
              value="1"
              checked={values.lunch_deduction_exempt === '1'}
            />
            <span>Exempt this employee from the automatic 1-hour lunch deduction on shifts of 6 hours or more.</span>
          </label>
          <div class="muted" style="margin-top:6px;">
            Leave this unchecked for most employees. Check it only for the 1–2 employees who should keep full hours.
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