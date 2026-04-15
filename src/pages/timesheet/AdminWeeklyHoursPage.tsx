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
          <p>Admin-only weekly labor summary for all employees. Click into any employee week to review individual entries, make direct corrections, approve or reopen the week, and export payroll-ready reports.</p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={`/timesheet/admin-hours?start=${prevWeekStart}`}>Previous Week</a>
          <a class="btn" href="/timesheet/admin-hours">This Week</a>
          <a class="btn btn-primary" href={`/timesheet/admin-hours?start=${nextWeekStart}`}>Next Week</a>
          <a class="btn btn-primary" href={`/timesheet/admin-hours/export.pdf?start=${start}`} target="_blank" rel="noreferrer">Export PDF</a>
          <a class="btn" href={`/timesheet/admin-hours/export.csv?start=${start}`}>Export CSV</a>
        </div>
      </div>

      <div class="stat-grid stat-grid-4" style="margin-bottom:16px;">
        <div class="stat-card stat-card-navy">
          <div class="stat-label">Week</div>
          <div class="stat-value" style="font-size:18px;">{start}</div>
          <div class="stat-sub">through {end}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Employees</div>
          <div class="stat-value">{employeeCount}</div>
          <div class="stat-sub">shown in report</div>
        </div>
        <div class="stat-card stat-card-accent">
          <div class="stat-label">Total Hours</div>
          <div class="stat-value">{fmtHours(totalHours)}</div>
          <div class="stat-sub">for selected week</div>
        </div>
        <div class="stat-card stat-card-green">
          <div class="stat-label">Approved</div>
          <div class="stat-value">{approvedCount}</div>
          <div class="stat-sub">employee weeks locked</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Employee Hours</h2>
          <div class="actions">
            <a class="btn" href={`/timesheet/admin-hours/export.csv?start=${start}`}>Export CSV</a>
            <a class="btn btn-primary" href={`/timesheet/admin-hours/export.pdf?start=${start}`} target="_blank" rel="noreferrer">Export PDF</a>
          </div>
        </div>
        <div class="table-wrap" style="margin:0 -18px -16px;">
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
                <th class="right">Actions</th>
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
                  <td class="right">
                    <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                      <a class="btn" href={`/timesheet?employee_id=${row.employee_id}&start=${start}`}>View Entries</a>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colspan={12} class="muted">No employee hours found for this week.</td>
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
