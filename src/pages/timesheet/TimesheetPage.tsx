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
  job_id: number | null;
  job_name: string;
  hours: number;
  note: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  entry_method: string;
  approval_status: string;
  has_pending_edit_request?: number;
}

interface PendingRequest {
  id: number;
  employee_name: string;
  job_name: string;
  original_job_name: string;
  original_clock_in_at: string | null;
  original_clock_out_at: string | null;
  proposed_clock_in_at: string;
  proposed_clock_out_at: string;
  request_reason: string;
  created_at: string;
}

interface ActiveClockEntry {
  id: number;
  job_id: number | null;
  job_name: string;
  clock_in_at: string;
}

interface CurrentEmployeeContext {
  employeeId: number;
  employeeName: string;
}

interface WeekApproval {
  id: number;
  employee_id: number;
  week_start: string;
  approved_at: string;
  note: string | null;
  approved_by_user_id: number;
  approved_by_name: string | null;
}

interface CalendarWeekSummary {
  week_start: string;
  week_end: string;
  total_hours: number;
  entry_count: number;
  approved_at: string | null;
  approved_by_name: string | null;
  is_selected: boolean;
  is_approved: boolean;
}

interface CalendarDaySummary {
  date: string;
  total_hours: number;
  is_approved_week: boolean;
  is_current_month: boolean;
  week_start: string;
}

interface TimesheetPageProps {
  employees: Employee[];
  jobs: Job[];
  employeeId: number | null;
  start: string;
  dates: string[];
  existing: TimeEntry[];
  pendingRequests: PendingRequest[];
  currentEmployeeContext?: CurrentEmployeeContext | null;
  activeClockEntry?: ActiveClockEntry | null;
  isEmployeeUser: boolean;
  canUseSelfClock: boolean;
  canRequestEdits: boolean;
  canManageTimeEntries: boolean;
  canApproveEditRequests: boolean;
  csrfToken: string;
  weekApproval?: WeekApproval | null;
  weekCalendar: CalendarWeekSummary[];
  selectedWeekHours: number;
  selectedWeekEntryCount: number;
  pendingWeekEditRequestCount: number;
  openClockEntryCount: number;
  selectedWeekLabel: string;
  prevWeekStart: string;
  nextWeekStart: string;
  calendarMonth: string;
  prevCalendarMonth: string;
  nextCalendarMonth: string;
  calendarMonthLabel: string;
  monthCalendarDays: CalendarDaySummary[];
  error?: string;
  success?: string;
  showAdminHoursLink?: boolean;
}

const pageScript = `
document.addEventListener('DOMContentLoaded', function () {
  function toLocalDisplay(utcValue) {
    if (!utcValue) return '';
    const d = new Date(utcValue);
    if (Number.isNaN(d.getTime())) return utcValue;
    return d.toLocaleString();
  }

  function toLocalInputValue(utcValue) {
    if (!utcValue) return '';
    const d = new Date(utcValue);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return [
      d.getFullYear(), '-', pad(d.getMonth() + 1), '-', pad(d.getDate()),
      'T', pad(d.getHours()), ':', pad(d.getMinutes())
    ].join('');
  }

  document.querySelectorAll('[data-utc-display]').forEach((node) => {
    const value = node.getAttribute('data-utc-display') || '';
    node.textContent = toLocalDisplay(value);
  });

  document.querySelectorAll('input[data-initial-utc]').forEach((input) => {
    const value = input.getAttribute('data-initial-utc') || '';
    input.value = toLocalInputValue(value);
  });

  document.querySelectorAll('form[data-time-submit]').forEach((form) => {
    form.addEventListener('submit', function () {
      [['clock_in_local', 'clock_in_utc'], ['clock_out_local', 'clock_out_utc']].forEach(([localName, utcName]) => {
        const localInput = form.querySelector('[name="' + localName + '"]');
        const utcInput = form.querySelector('[name="' + utcName + '"]');
        if (!localInput || !utcInput) return;
        const raw = localInput.value;
        utcInput.value = raw ? new Date(raw).toISOString() : '';
      });

      const resolveLocal = form.querySelector('[name="clock_out_local"]');
      const resolveUtc = form.querySelector('[name="clock_out_utc"]');
      if (resolveLocal && resolveUtc && !form.querySelector('[name="clock_in_local"]')) {
        const raw = resolveLocal.value;
        resolveUtc.value = raw ? new Date(raw).toISOString() : '';
      }
    });
  });

  document.querySelectorAll('form[data-punch-now]').forEach((form) => {
    form.addEventListener('submit', function () {
      const hidden = form.querySelector('[name="client_now_utc"]');
      if (hidden) hidden.value = new Date().toISOString();
    });
  });

  document.querySelectorAll('[data-fill-now]').forEach((button) => {
    button.addEventListener('click', function () {
      const target = document.getElementById(button.getAttribute('data-fill-now') || '');
      if (!target) return;
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      target.value = [
        d.getFullYear(), '-', pad(d.getMonth() + 1), '-', pad(d.getDate()),
        'T', pad(d.getHours()), ':', pad(d.getMinutes())
      ].join('');
    });
  });
});
`;

export const TimesheetPage: FC<TimesheetPageProps> = ({
  employees,
  jobs,
  employeeId,
  start,
  dates,
  existing,
  pendingRequests,
  currentEmployeeContext,
  activeClockEntry,
  isEmployeeUser,
  canUseSelfClock,
  canRequestEdits,
  canManageTimeEntries,
  canApproveEditRequests,
  csrfToken,
  weekApproval,
  weekCalendar,
  selectedWeekHours,
  selectedWeekEntryCount,
  pendingWeekEditRequestCount,
  openClockEntryCount,
  selectedWeekLabel,
  prevWeekStart,
  nextWeekStart,
  calendarMonth,
  prevCalendarMonth,
  nextCalendarMonth,
  calendarMonthLabel,
  monthCalendarDays,
  error,
  success,
  showAdminHoursLink,
}) => {
  const viewingOwnEntries = !!(currentEmployeeContext && employeeId === currentEmployeeContext.employeeId);
  const selectedEmployee = employees.find((employee) => employee.id === employeeId) || null;
  const weekLocked = !!weekApproval;
  const calendarTargetEmployeeId = employeeId ? `&employee_id=${employeeId}` : '';
  const canShowEditRequests = canRequestEdits && viewingOwnEntries && !weekLocked;

  const todayStr = new Date().toISOString().slice(0, 10);
  const calendarWeeks: CalendarDaySummary[][] = [];
  for (let i = 0; i < monthCalendarDays.length; i += 7) {
    calendarWeeks.push(monthCalendarDays.slice(i, i + 7));
  }

  const renderResolveOpenForm = (entryId: number, note?: string | null, label = 'Resolve Open Entry') => (
    <details style="display:inline-block; text-align:left; width:100%;">
      <summary class="btn edit-request-summary">{label}</summary>
      <div class="card details-card" style="min-width:420px;">
        <form method="post" action={`/timeclock/resolve-open/${entryId}`} data-time-submit>
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <label>Actual Clock Out</label>
          <div class="edit-request-actions">
            <input id={`resolve-open-${entryId}`} type="datetime-local" name="clock_out_local" required />
            <button type="button" class="btn" data-fill-now={`resolve-open-${entryId}`}>Now</button>
          </div>
          <input type="hidden" name="clock_out_utc" value="" />
          <label>Note (optional)</label>
          <input name="note" maxLength={500} value={note || ''} />
          <div class="actions actions-mobile-stack" style="margin-top:12px;">
            <button class="btn" type="submit">{label}</button>
          </div>
        </form>
      </div>
    </details>
  );

  const renderAdminEditForm = (entry: TimeEntry) => (
    <details style="display:inline-block; text-align:left; width:100%; margin-right:8px;">
      <summary class="btn edit-request-summary">Edit Entry</summary>
      <div class="card details-card" style="min-width:460px;">
        <form method="post" action={`/timesheet/admin-edit-entry/${entry.id}`} data-time-submit>
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <label>Job</label>
          <select name="job_id">
            <option value="">Unassigned / General Time</option>
            {jobs.map((job) => (
              <option value={String(job.id)} selected={entry.job_id === job.id}>
                {job.job_name}
                {job.client_name ? ` - ${job.client_name}` : ''}
              </option>
            ))}
          </select>

          <label>Clock In</label>
          <div class="edit-request-actions">
            <input id={`admin-clock-in-local-${entry.id}`} type="datetime-local" name="clock_in_local" data-initial-utc={entry.clock_in_at || ''} required />
            <button type="button" class="btn" data-fill-now={`admin-clock-in-local-${entry.id}`}>Now</button>
          </div>
          <input type="hidden" name="clock_in_utc" value="" />

          <label>Clock Out</label>
          <div class="edit-request-actions">
            <input id={`admin-clock-out-local-${entry.id}`} type="datetime-local" name="clock_out_local" data-initial-utc={entry.clock_out_at || ''} required />
            <button type="button" class="btn" data-fill-now={`admin-clock-out-local-${entry.id}`}>Now</button>
          </div>
          <input type="hidden" name="clock_out_utc" value="" />

          <label>Note (optional)</label>
          <input name="note" maxLength={500} value={entry.note || ''} />

          <label>Admin Edit Reason</label>
          <textarea name="edit_reason" required maxLength={500} placeholder="Why are you changing this entry?" />

          <div class="actions actions-mobile-stack" style="margin-top:12px;">
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </div>
        </form>
      </div>
    </details>
  );

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{isEmployeeUser ? 'Time Clock & History' : 'Weekly Timesheets'}</h1>
          <p>
            {isEmployeeUser
              ? 'Review current and past weeks, request edits before approval, and use your personal clock.'
              : 'Review weekly labor history, approve employee weeks, and lock timesheets after manager review.'}
          </p>
        </div>
        <div class="actions actions-mobile-stack">
          <a class="btn" href={`/timesheet?start=${prevWeekStart}${calendarTargetEmployeeId}`}>Previous Week</a>
          <a class="btn" href={`/timesheet${employeeId ? `?employee_id=${employeeId}` : ''}`}>This Week</a>
          <a class="btn btn-primary" href={`/timesheet?start=${nextWeekStart}${calendarTargetEmployeeId}`}>Next Week</a>
          {showAdminHoursLink ? (
            <>
              <a class="btn" href={`/timesheet/admin-hours?start=${start}`}>Weekly Hours</a>
              {!isEmployeeUser ? <a class="btn" href={`/timesheet/admin-hours?start=${start}`}>Back to Weekly Overview</a> : null}
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div class="card" style="margin-bottom:14px; border-color:#FECACA; background:#FEF2F2; color:#991B1B;">{error}</div>
      ) : null}

      {success ? (
        <div class="card" style="margin-bottom:14px; border-color:#BBF7D0; background:#F0FDF4; color:#166534;">{success}</div>
      ) : null}

      {canUseSelfClock && currentEmployeeContext ? (
        <div class="card" style="margin-bottom:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
            <div>
              <h1 style="font-size:18px; margin:0;">My Clock</h1>
              <p style="margin:4px 0 0;">
                Clocking in as <b>{currentEmployeeContext.employeeName}</b>
              </p>
            </div>
            {activeClockEntry ? (
              <div style="display:flex; align-items:center; gap:8px; padding:6px 12px; background:#0D3321; border:1px solid #166534; border-radius:20px;">
                <div style="width:8px; height:8px; background:#22C55E; border-radius:50%; flex:0 0 auto;"></div>
                <span style="font-size:13px; font-weight:700; color:#22C55E;">Clocked In</span>
              </div>
            ) : (
              <div style="display:flex; align-items:center; gap:8px; padding:6px 12px; background:#1A1A2E; border:1px solid #374151; border-radius:20px;">
                <div style="width:8px; height:8px; background:#6B7280; border-radius:50%; flex:0 0 auto;"></div>
                <span style="font-size:13px; font-weight:600; color:#9CA3AF;">Not Clocked In</span>
              </div>
            )}
          </div>

          {activeClockEntry ? (
            <div>
              <div class="clock-status-grid" style="margin-bottom:16px;">
                <div class="card clock-card">
                  <div class="muted">Job / Type</div>
                  <div class="clock-card-value"><b>{activeClockEntry.job_name}</b></div>
                </div>
                <div class="card clock-card">
                  <div class="muted">Clocked in at</div>
                  <div class="clock-card-value" data-utc-display={activeClockEntry.clock_in_at}>{activeClockEntry.clock_in_at}</div>
                </div>
              </div>

              <p class="muted" style="margin:0 0 10px; font-size:13px;">When you are done working, punch out to record your hours.</p>

              <form method="post" action="/timeclock/punch-out" data-punch-now style="display:inline-block;">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="client_now_utc" value="" />
                <button class="btn btn-primary" type="submit" style="font-size:15px; padding:10px 32px;">Punch Out</button>
              </form>

              <div style="margin-top:18px; padding-top:14px; border-top:1px solid #1F2937;">
                <p class="muted" style="margin:0 0 8px; font-size:12px;">
                  Need to correct your clock-in time? Use the option below instead of punching out.
                </p>
                {renderResolveOpenForm(activeClockEntry.id, '', 'Correct Clock-In Time')}
              </div>
            </div>
          ) : (
            <div>
              <p class="muted" style="margin:0 0 12px; font-size:13px;">
                Select a job if you are working on a specific project, then punch in. You can add a note if needed.
              </p>
              <form method="post" action="/timeclock/punch-in" data-punch-now>
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="client_now_utc" value="" />

                <div class="row" style="max-width:800px;">
                  <div>
                    <label>Job (optional)</label>
                    <select name="job_id">
                      <option value="">General — no specific job</option>
                      {jobs.map((job) => (
                        <option value={String(job.id)}>
                          {job.job_name}
                          {job.client_name ? ` - ${job.client_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label>Note (optional)</label>
                    <input name="note" maxLength={500} placeholder="e.g. Morning shift, special task..." />
                  </div>

                  <div style="flex:0;">
                    <label>&nbsp;</label>
                    <button class="btn btn-primary" type="submit" style="font-size:15px; padding:10px 28px;">Punch In</button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : null}

      <div class="card">
        <form method="get" action="/timesheet">
          <div class="row" style="max-width:680px;">
            {!isEmployeeUser ? (
              <div>
                <label>Employee</label>
                <select name="employee_id" required>
                  {employees.length > 0 ? employees.map((employee) => (
                    <option value={String(employee.id)} selected={employeeId === employee.id}>{employee.name}</option>
                  )) : <option value="">No active employees</option>}
                </select>
              </div>
            ) : null}

            <div>
              <label>Week Starting</label>
              <input type="date" name="start" value={start} required />
            </div>

            <div style="flex:0;">
              <label>&nbsp;</label>
              <button class="btn btn-primary" type="submit">Load Week</button>
            </div>
          </div>
        </form>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="page-head" style="margin:0 0 8px;">
          <div>
            <h1 style="font-size:18px; margin:0;">Week Summary</h1>
            <p>
              {selectedEmployee ? <><b>{selectedEmployee.name}</b> · </> : null}
              {selectedWeekLabel}
            </p>
          </div>
          <div>
            {weekLocked ? <span class="badge badge-good">Approved / Locked</span> : <span class="badge badge-warn">Open Week</span>}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-top:10px;">
          <div class="card" style="margin:0;">
            <div class="muted">Total Hours</div>
            <div style="font-size:24px; font-weight:800; margin-top:6px;">{selectedWeekHours.toFixed(2)}</div>
          </div>
          <div class="card" style="margin:0;">
            <div class="muted">Entries</div>
            <div style="font-size:24px; font-weight:800; margin-top:6px;">{selectedWeekEntryCount}</div>
          </div>
          <div class="card" style="margin:0;">
            <div class="muted">Pending Edit Requests</div>
            <div style="font-size:24px; font-weight:800; margin-top:6px;">{pendingWeekEditRequestCount}</div>
          </div>
          <div class="card" style="margin:0;">
            <div class="muted">Open Clock Entries</div>
            <div style="font-size:24px; font-weight:800; margin-top:6px;">{openClockEntryCount}</div>
          </div>
        </div>

        <div style="margin-top:12px;">
          {weekLocked ? (
            <div class="muted">
              Approved <span data-utc-display={weekApproval?.approved_at || ''}>{weekApproval?.approved_at || ''}</span>
              {weekApproval?.approved_by_name ? <> by <b>{weekApproval.approved_by_name}</b></> : null}.
              Employee edits are locked until a manager reopens this week.
            </div>
          ) : (
            <div class="muted">
              This week is still open. Employees can request edits, and managers can continue entering or adjusting time.
            </div>
          )}
        </div>

        {!isEmployeeUser && employeeId ? (
          <div class="actions actions-mobile-stack" style="margin-top:14px; justify-content:flex-start;">
            {weekLocked ? (
              <form method="post" action="/timesheet/week-reopen">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="employee_id" value={String(employeeId)} />
                <input type="hidden" name="start" value={start} />
                <button class="btn" type="submit">Reopen Week</button>
              </form>
            ) : (
              <form method="post" action="/timesheet/week-approve">
                <input type="hidden" name="csrf_token" value={csrfToken} />
                <input type="hidden" name="employee_id" value={String(employeeId)} />
                <input type="hidden" name="start" value={start} />
                <button class="btn btn-primary" type="submit">Approve & Lock Week</button>
              </form>
            )}
          </div>
        ) : null}
      </div>

      <div class="card" style="margin-top:14px;">
        {/* Header: title + month navigator */}
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
          <div>
            <h1 style="font-size:18px; margin:0;">Monthly Hours</h1>
            <p style="margin:4px 0 0; color:#64748B; font-size:13px;">Click any day to view that week&apos;s entries.</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <a
              class="btn"
              href={`/timesheet?start=${start}${calendarTargetEmployeeId}&cal_month=${prevCalendarMonth}`}
              style="padding:5px 12px; font-size:16px; line-height:1;"
            >&#8592;</a>
            <span style="font-weight:700; font-size:15px; min-width:140px; text-align:center;">{calendarMonthLabel}</span>
            <a
              class="btn"
              href={`/timesheet?start=${start}${calendarTargetEmployeeId}&cal_month=${nextCalendarMonth}`}
              style="padding:5px 12px; font-size:16px; line-height:1;"
            >&#8594;</a>
          </div>
        </div>

        {monthCalendarDays.length === 0 ? (
          <div class="muted">No calendar data available for this employee.</div>
        ) : (
          <div>
            {/* Scrollable calendar grid — prevents squashing on narrow phones */}
            <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
              <div style="min-width:300px;">
                {/* Day-of-week header row */}
                <div style="display:grid; grid-template-columns:4px repeat(7,minmax(36px,1fr)); gap:2px; margin-bottom:4px;">
                  <div></div>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label) => (
                    <div style="text-align:center; font-size:11px; font-weight:700; color:#475569; padding:3px 0; letter-spacing:0.06em; text-transform:uppercase;">{label}</div>
                  ))}
                </div>

                {/* Calendar week rows */}
                {calendarWeeks.map((week) => {
                  const weekHasHours = week.some((d) => d.total_hours > 0);
                  const isApproved = week[0].is_approved_week;
                  const stripeColor = isApproved ? '#16A34A' : (weekHasHours ? '#D97706' : 'transparent');

                  return (
                    <div style="display:grid; grid-template-columns:4px repeat(7,minmax(36px,1fr)); gap:2px; margin-bottom:2px;">
                      {/* Approval status stripe */}
                      <div
                        title={isApproved ? 'Approved week' : (weekHasHours ? 'Open — not yet approved' : '')}
                        style={`background:${stripeColor}; border-radius:2px;`}
                      />
                      {week.map((day) => {
                        const isToday = day.date === todayStr;
                        const isSelectedWeek = day.week_start === start;
                        const dimmed = !day.is_current_month;
                        const dayNum = new Date(`${day.date}T00:00:00Z`).getUTCDate();

                        const bgColor = isToday ? '#1E3A5F' : isSelectedWeek ? '#18293F' : '#0F172A';
                        const borderColor = isToday ? '#F59E0B' : isSelectedWeek ? '#2563EB' : '#1E293B';

                        return (
                          <a
                            href={`/timesheet?start=${day.week_start}${calendarTargetEmployeeId}&cal_month=${calendarMonth}`}
                            style={`display:block; min-height:48px; padding:4px 5px; background:${bgColor}; border:1px solid ${borderColor}; border-radius:4px; text-decoration:none; opacity:${dimmed ? '0.3' : '1'};`}
                          >
                            <div style={`font-size:11px; font-weight:${isToday ? '800' : '600'}; color:${isToday ? '#F59E0B' : '#CBD5E1'};`}>
                              {dayNum}
                            </div>
                            {day.total_hours > 0 ? (
                              <div style="font-size:10px; font-weight:700; color:#FBBF24; margin-top:2px; white-space:nowrap; overflow:hidden;">
                                {Number.isInteger(day.total_hours) ? `${day.total_hours}h` : `${day.total_hours.toFixed(1)}h`}
                              </div>
                            ) : null}
                          </a>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div style="display:flex; gap:20px; margin-top:14px; flex-wrap:wrap; align-items:center;">
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#64748B;">
                <div style="width:3px; height:14px; background:#16A34A; border-radius:2px; flex:0 0 auto;"></div>
                <span>Approved week</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#64748B;">
                <div style="width:3px; height:14px; background:#D97706; border-radius:2px; flex:0 0 auto;"></div>
                <span>Open week</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#64748B;">
                <div style="width:12px; height:12px; border:1px solid #2563EB; border-radius:2px; flex:0 0 auto;"></div>
                <span>Currently viewing</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px; font-size:11px; color:#64748B;">
                <div style="width:12px; height:12px; border:1px solid #F59E0B; border-radius:2px; flex:0 0 auto;"></div>
                <span>Today</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div class="card" style="margin-top:14px;">
        <b>{isEmployeeUser ? 'Entries for Selected Week' : 'Existing Entries'}</b>
        <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Job / Type</th>
                <th>Method</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th class="right">Hours</th>
                <th>Status</th>
                <th>Note</th>
                <th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {existing.length > 0 ? existing.map((entry) => (
                <tr>
                  <td>{entry.date}</td>
                  <td>{entry.job_name}</td>
                  <td>{entry.entry_method}</td>
                  <td data-utc-display={entry.clock_in_at || ''}>{entry.clock_in_at || ''}</td>
                  <td data-utc-display={entry.clock_out_at || ''}>{entry.clock_out_at || ''}</td>
                  <td class="right">{entry.hours}</td>
                  <td>
                    {entry.approval_status === 'pending_edit' ? (
                      <span class="badge badge-warn">Pending Edit Approval</span>
                    ) : weekLocked ? (
                      <span class="badge badge-good">Week Approved</span>
                    ) : (
                      <span class="badge badge-good">Approved</span>
                    )}
                  </td>
                  <td class="muted">{entry.note || ''}</td>
                  <td class="right">
                    {viewingOwnEntries ? (
                      canShowEditRequests && entry.clock_in_at && entry.clock_out_at ? (
                        <details style="display:inline-block; text-align:left; width:100%;">
                          <summary class="btn edit-request-summary">Request Edit</summary>
                          <div class="card details-card" style="min-width:420px;">
                            <form method="post" action={`/timeclock/request-edit/${entry.id}`} data-time-submit>
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <label>Clock In</label>
                              <div class="edit-request-actions">
                                <input id={`clock-in-local-${entry.id}`} type="datetime-local" name="clock_in_local" data-initial-utc={entry.clock_in_at || ''} required />
                                <button type="button" class="btn" data-fill-now={`clock-in-local-${entry.id}`}>Now</button>
                              </div>
                              <input type="hidden" name="clock_in_utc" value="" />
                              <label>Clock Out</label>
                              <div class="edit-request-actions">
                                <input id={`clock-out-local-${entry.id}`} type="datetime-local" name="clock_out_local" data-initial-utc={entry.clock_out_at || ''} required />
                                <button type="button" class="btn" data-fill-now={`clock-out-local-${entry.id}`}>Now</button>
                              </div>
                              <input type="hidden" name="clock_out_utc" value="" />
                              <label>Note (optional)</label>
                              <input name="note" maxLength={500} value={entry.note || ''} />
                              <label>Why are you requesting this edit?</label>
                              <textarea name="request_reason" required maxLength={500} />
                              <div class="actions actions-mobile-stack" style="margin-top:12px;">
                                <button class="btn btn-primary" type="submit" disabled={entry.has_pending_edit_request === 1}>
                                  {entry.has_pending_edit_request === 1 ? 'Request Already Pending' : 'Submit Edit Request'}
                                </button>
                              </div>
                            </form>
                          </div>
                        </details>
                      ) : entry.clock_in_at && !entry.clock_out_at && !weekLocked ? (
                        renderResolveOpenForm(entry.id, entry.note || '', 'Resolve Open Entry')
                      ) : (
                        <span class="muted">{weekLocked ? 'Week approved' : 'View only'}</span>
                      )
                    ) : canManageTimeEntries && !weekLocked && entry.clock_in_at && !entry.clock_out_at ? (
                      renderResolveOpenForm(entry.id, entry.note || '', 'Close Entry')
                    ) : canManageTimeEntries && !weekLocked && entry.clock_in_at && entry.clock_out_at ? (
                      <div style="display:flex; gap:8px; justify-content:flex-end; align-items:flex-start; flex-wrap:wrap;">
                        {renderAdminEditForm(entry)}
                        <form method="post" action={`/delete_time/${entry.id}`} style="display:inline;">
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit">Delete</button>
                        </form>
                      </div>
                    ) : canManageTimeEntries && !weekLocked ? (
                      <form method="post" action={`/delete_time/${entry.id}`} style="display:inline;">
                        <input type="hidden" name="csrf_token" value={csrfToken} />
                        <button class="btn" type="submit">Delete</button>
                      </form>
                    ) : (
                      <span class="muted">{weekLocked ? 'Week approved' : 'View only'}</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colspan={9} class="muted">No time entries for this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isEmployeeUser ? (
        <div class="card" style="margin-top:14px;">
          <b>{canManageTimeEntries ? 'Add Manual Time Entries' : 'Manual Time Entries'}</b>
          <div class="muted" style="margin-top:8px;">
            Enter start and end times for any day in this week. Job assignment is optional.
            {weekLocked ? ' This week is approved, so manual changes are locked until it is reopened.' : ''}
          </div>
          <form method="post" action="/timesheet" style="margin-top:10px;">
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="employee_id" value={String(employeeId || '')} />
            <input type="hidden" name="start" value={start} />
            <div class="table-wrap table-wrap-tight">
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time In</th>
                    <th>Time Out</th>
                    <th>Job</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map((date) => (
                    <tr>
                      <td>
                        <input type="date" name="row_date" value={date} readonly style="min-width:130px;" disabled={!canManageTimeEntries || weekLocked} />
                      </td>
                      <td>
                        <input type="time" name="row_time_in_local" style="min-width:120px;" disabled={!canManageTimeEntries || weekLocked} />
                      </td>
                      <td>
                        <input type="time" name="row_time_out_local" style="min-width:120px;" disabled={!canManageTimeEntries || weekLocked} />
                      </td>
                      <td>
                        <select name="row_job_id" style="min-width:160px;" disabled={!canManageTimeEntries || weekLocked}>
                          <option value="">Unassigned / General Time</option>
                          {jobs.map((job) => <option value={String(job.id)}>{job.job_name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input name="row_note" placeholder="Optional" maxLength={500} disabled={!canManageTimeEntries || weekLocked} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div class="actions actions-mobile-stack" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit" disabled={!canManageTimeEntries || !employeeId || weekLocked}>Save Entries</button>
            </div>
          </form>
        </div>
      ) : null}

      {!isEmployeeUser ? (
        <div class="card" style="margin-top:14px;">
          <b>Pending Edit Requests</b>
          <div class="table-wrap table-wrap-tight" style="margin-top:10px;">
            <table class="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Original Type</th>
                  <th>Proposed Type</th>
                  <th>Original Time</th>
                  <th>Proposed Time</th>
                  <th>Reason</th>
                  <th>Requested</th>
                  <th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.length > 0 ? pendingRequests.map((request) => (
                  <tr>
                    <td>{request.employee_name}</td>
                    <td>{request.original_job_name}</td>
                    <td>{request.job_name}</td>
                    <td>
                      <div data-utc-display={request.original_clock_in_at || ''}>{request.original_clock_in_at || ''}</div>
                      <div data-utc-display={request.original_clock_out_at || ''}>{request.original_clock_out_at || ''}</div>
                    </td>
                    <td>
                      <div data-utc-display={request.proposed_clock_in_at}>{request.proposed_clock_in_at}</div>
                      <div data-utc-display={request.proposed_clock_out_at}>{request.proposed_clock_out_at}</div>
                    </td>
                    <td>{request.request_reason}</td>
                    <td data-utc-display={request.created_at}>{request.created_at}</td>
                    <td class="right">
                      {canApproveEditRequests ? (
                        <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                          <form method="post" action={`/timeclock/edit-request/${request.id}/approve`}>
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button class="btn btn-primary" type="submit">Approve</button>
                          </form>
                          <form method="post" action={`/timeclock/edit-request/${request.id}/reject`}>
                            <input type="hidden" name="csrf_token" value={csrfToken} />
                            <button class="btn" type="submit">Reject</button>
                          </form>
                        </div>
                      ) : <span class="muted">View only</span>}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colspan={8} class="muted">No pending edit requests.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <script dangerouslySetInnerHTML={{ __html: pageScript }} />
    </div>
  );
};

export default TimesheetPage;
