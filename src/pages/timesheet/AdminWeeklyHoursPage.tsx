import type { FC } from 'hono/jsx';

interface AdminHoursRow {
  employee_id: number;
  employee_name: string;
  monday_hours: number;
  tuesday_hours: number;
  wednesday_hours: number;
  thursday_hours: number;
  friday_hours: number;
  saturday_hours: number;
  sunday_hours: number;
  total_hours: number;
  entry_count: number;
  approved_at: string | null;
  approved_by_name: string | null;
}

interface AdminWeeklyHoursPageProps {
  start: string;
  end: string;
  prevWeekStart: string;
  nextWeekStart: string;
  rows: AdminHoursRow[];
  totalHours: number;
  approvedCount: number;
  employeeCount: number;
}

function fmtHours(value: number): string {
  return Number(value || 0).toFixed(2);
}

export const AdminWeeklyHoursPage: FC<AdminWeeklyHoursPageProps> = ({
  start,
  end,
  prevWeekStart,
  nextWeekStart,
  rows,
  totalHours,
  approvedCount,
  employeeCount,
}) => {
  return (
    <div>
      <div class="page-head">
        <div>
          <h1>Weekly Employee Hours</h1>
          <p>Admin-only weekly labor summary for all employees. Export the week to CSV for Excel or Google Sheets.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={`/timesheet/admin-hours?start=${prevWeekStart}`}>Previous Week</a>
          <a class="btn" href="/timesheet/admin-hours">This Week</a>
          <a class="btn btn-primary" href={`/timesheet/admin-hours?start=${nextWeekStart}`}>Next Week</a>
          <a class="btn" href={`/timesheet/admin-hours/export.csv?start=${start}`}>Export CSV</a>
        </div>
      </div>

      <div class="grid grid-4" style="margin-bottom:16px;">
        <div class="card">
          <div class="muted">Week</div>
          <div style="font-size:22px;font-weight:900;">{start}</div>
          <div class="muted">through {end}</div>
        </div>
        <div class="card">
          <div class="muted">Employees</div>
          <div style="font-size:22px;font-weight:900;">{employeeCount}</div>
          <div class="muted">shown in report</div>
        </div>
        <div class="card">
          <div class="muted">Total Hours</div>
          <div style="font-size:22px;font-weight:900;">{fmtHours(totalHours)}</div>
          <div class="muted">for selected week</div>
        </div>
        <div class="card">
          <div class="muted">Approved Weeks</div>
          <div style="font-size:22px;font-weight:900;">{approvedCount}</div>
          <div class="muted">employee weeks locked</div>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th class="right">Mon</th>
                <th class="right">Tue</th>
                <th class="right">Wed</th>
                <th class="right">Thu</th>
                <th class="right">Fri</th>
                <th class="right">Sat</th>
                <th class="right">Sun</th>
                <th class="right">Total</th>
                <th class="right">Entries</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? rows.map((row) => (
                <tr>
                  <td>
                    <div style="font-weight:800;">{row.employee_name}</div>
                    <div class="muted">Employee #{row.employee_id}</div>
                  </td>
                  <td class="right">{fmtHours(row.monday_hours)}</td>
                  <td class="right">{fmtHours(row.tuesday_hours)}</td>
                  <td class="right">{fmtHours(row.wednesday_hours)}</td>
                  <td class="right">{fmtHours(row.thursday_hours)}</td>
                  <td class="right">{fmtHours(row.friday_hours)}</td>
                  <td class="right">{fmtHours(row.saturday_hours)}</td>
                  <td class="right">{fmtHours(row.sunday_hours)}</td>
                  <td class="right" style="font-weight:900;">{fmtHours(row.total_hours)}</td>
                  <td class="right">{row.entry_count}</td>
                  <td>
                    {row.approved_at ? (
                      <div>
                        <span class="badge badge-good">Approved</span>
                        <div class="muted" style="margin-top:6px;">
                          {row.approved_by_name ? `By ${row.approved_by_name}` : 'Approved'}
                        </div>
                      </div>
                    ) : (
                      <span class="badge badge-warn">Open</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colspan={11} class="muted">No employee hours found for this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminWeeklyHoursPage;
