import type { FC } from 'hono/jsx';

interface Employee {
  id: number;
  name: string;
}

interface Job {
  id: number;
  job_name: string;
  client_name: string | null;
  status: string | null;
}

interface TimeEntry {
  id: number;
  date: string;
  job_id: number;
  job_name: string;
  hours: number;
  note: string | null;
}

interface TimesheetPageProps {
  employees: Employee[];
  jobs: Job[];
  employeeId: number | null;
  start: string;
  dates: string[];
  existing: TimeEntry[];
  csrfToken: string;
  error?: string;
  success?: string;
}

export const TimesheetPage: FC<TimesheetPageProps> = ({
  employees,
  jobs,
  employeeId,
  start,
  dates,
  existing,
  csrfToken,
  error,
  success,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Weekly Timesheet</h1>
          <p>Select an employee and week to log and review time entries.</p>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="/timesheet">Refresh</a>
        </div>
      </div>

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

      <div class="card">
        <form method="get" action="/timesheet">
          <div class="row">
            <div>
              <label>Employee</label>
              <select name="employee_id" required>
                {employees.length > 0 ? (
                  employees.map((e) => (
                    <option value={String(e.id)} selected={employeeId === e.id}>
                      {e.name}
                    </option>
                  ))
                ) : (
                  <option value="">No active employees</option>
                )}
              </select>
            </div>

            <div>
              <label>Week Starting</label>
              <input type="date" name="start" value={start} required />
            </div>

            <div style="flex:0;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" type="submit">Load</button>
            </div>
          </div>
        </form>
      </div>

      <div class="card" style="margin-top:14px;">
        <b>Existing Entries</b>
        <div class="table-wrap" style="margin-top:10px;">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Job</th>
                <th class="right">Hours</th>
                <th>Note</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {existing.length > 0 ? (
                existing.map((t) => (
                  <tr>
                    <td>{t.date}</td>
                    <td>{t.job_name}</td>
                    <td class="right">{t.hours}</td>
                    <td class="muted">{t.note || ''}</td>
                    <td class="right">
                      <form method="post" action={`/delete_time/${t.id}`} style="display:inline;">
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <button class="btn" type="submit">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colspan={5} class="muted">No time entries for this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <b>Add Time Entries</b>
        <form method="post" action="/timesheet" style="margin-top:10px;">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <input type="hidden" name="employee_id" value={String(employeeId || '')} />
          <input type="hidden" name="start" value={start} />

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Job</th>
                  <th>Hours</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((d) => (
                  <tr>
                    <td>
                      <input type="date" name="row_date" value={d} readonly style="min-width:130px;" />
                    </td>
                    <td>
                      <select name="row_job_id" style="min-width:160px;">
                        <option value="">--</option>
                        {jobs.map((j) => (
                          <option value={String(j.id)}>
                            {j.job_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        name="row_hours"
                        step="0.25"
                        min="0"
                        max="24"
                        value="0"
                        style="width:80px;"
                      />
                    </td>
                    <td>
                      <input name="row_note" placeholder="Optional" maxLength={500} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div class="actions" style="margin-top:16px;">
            <button class="btn btn-primary" type="submit" disabled={employees.length === 0 || jobs.length === 0}>
              Save Entries
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimesheetPage;