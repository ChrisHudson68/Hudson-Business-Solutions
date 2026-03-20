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
  canRequestOwnEntryEdits: boolean;
  csrfToken: string;
  error?: string;
  success?: string;
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
      d.getFullYear(),
      '-',
      pad(d.getMonth() + 1),
      '-',
      pad(d.getDate()),
      'T',
      pad(d.getHours()),
      ':',
      pad(d.getMinutes())
    ].join('');
  }

  function fillHiddenUtcInput(localInput, utcInput) {
    if (!localInput || !utcInput) return;
    const raw = localInput.value;
    if (!raw) {
      utcInput.value = '';
      return;
    }

    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) {
      utcInput.value = '';
      return;
    }

    utcInput.value = dt.toISOString();
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
      form.querySelectorAll('[data-utc-target]').forEach((localInput) => {
        const targetName = localInput.getAttribute('data-utc-target') || '';
        if (!targetName) return;
        const utcInput = form.querySelector('[name="' + targetName + '"]');
        fillHiddenUtcInput(localInput, utcInput);
      });
    });
  });

  document.querySelectorAll('form[data-punch-now]').forEach((form) => {
    form.addEventListener('submit', function () {
      const hidden = form.querySelector('[name="client_now_utc"]');
      if (!hidden) return;
      hidden.value = new Date().toISOString();
    });
  });

  const nowTargets = document.querySelectorAll('[data-fill-now]');
  nowTargets.forEach((button) => {
    button.addEventListener('click', function () {
      const target = document.getElementById(button.getAttribute('data-fill-now') || '');
      if (!target) return;
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      target.value = [
        d.getFullYear(),
        '-',
        pad(d.getMonth() + 1),
        '-',
        pad(d.getDate()),
        'T',
        pad(d.getHours()),
        ':',
        pad(d.getMinutes())
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
  canRequestOwnEntryEdits,
  csrfToken,
  error,
  success,
}) => {
  const hasAnyData =
    existing.length > 0 ||
    pendingRequests.length > 0 ||
    employees.length > 0 ||
    jobs.length > 0 ||
    !!activeClockEntry;

  return (
    <div>
      <div class="page-head">
        <div>
          <h1>{isEmployeeUser ? 'Time Clock' : 'Weekly Timesheet'}</h1>
          <p>
            {isEmployeeUser
              ? 'Punch in, punch out, and request edits that require manager approval.'
              : 'Manage weekly time entries, review edit approvals, and use your own clock when linked.'}
          </p>
        </div>
        <div class="actions actions-mobile-stack">
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

      {!hasAnyData ? (
        <div class="card" style="text-align:center; padding:36px 20px; margin-bottom:14px;">
          <div style="
            width:64px;
            height:64px;
            margin:0 auto 16px;
            border-radius:16px;
            background:#EFF6FF;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:28px;
            font-weight:900;
            color:#1D4ED8;
          ">
            ⏱
          </div>

          <h2 style="margin:0 0 10px;">No timesheet activity yet</h2>

          <p class="muted" style="max-width:560px; margin:0 auto 16px;">
            Timesheets and time clock entries help you track labor, understand job costs,
            approve edits, and measure how employee time affects profitability.
          </p>

          <p class="muted small" style="max-width:560px; margin:0 auto 18px;">
            Start by adding employees and jobs. Once those are in place, you can record hours,
            use the clock in / clock out workflow, and review weekly labor activity here.
          </p>

          <div class="actions actions-mobile-stack" style="justify-content:center;">
            <a class="btn" href="/employees">Go to Employees</a>
            <a class="btn btn-primary" href="/jobs">Go to Jobs</a>
          </div>
        </div>
      ) : null}

      {canUseSelfClock && currentEmployeeContext ? (
        <div class="card" style="margin-bottom:14px;">
          <div class="page-head" style="margin:0 0 10px;">
            <div>
              <h1 style="font-size:18px; margin:0;">My Clock</h1>
              <p>
                Employee: <b>{currentEmployeeContext.employeeName}</b>
              </p>
            </div>
          </div>

          {activeClockEntry ? (
            <div>
              <div class="badge badge-good" style="margin-bottom:10px;">Currently Clocked In</div>
              <div class="clock-status-grid">
                <div class="card clock-card">
                  <div class="muted">Type</div>
                  <div class="clock-card-value"><b>{activeClockEntry.job_name}</b></div>
                </div>
                <div class="card clock-card">
                  <div class="muted">Clock In</div>
                  <div class="clock-card-value" data-utc-display={activeClockEntry.clock_in_at}>
                    {activeClockEntry.clock_in_at}
                  </div>
                </div>
                <div class="card clock-card">
                  <div class="muted">Action</div>
                  <div class="actions actions-mobile-stack" style="margin-top:10px;">
                    <form method="post" action="/timeclock/punch-out" data-punch-now>
                      <input type="hidden" name="csrf_token" value={csrfToken} />
                      <input type="hidden" name="client_now_utc" value="" />
                      <button class="btn btn-primary" type="submit">Punch Out</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form method="post" action="/timeclock/punch-in" data-punch-now>
              <input type="hidden" name="csrf_token" value={csrfToken} />
              <input type="hidden" name="client_now_utc" value="" />

              <div class="row">
                <div>
                  <label>Note (optional)</label>
                  <input name="note" maxLength={500} placeholder="Optional shift note" />
                </div>

                <div style="flex:0;">
                  <label>&nbsp;</label>
                  <button class="btn btn-primary" type="submit">Punch In</button>
                </div>
              </div>
            </form>
          )}

          <div class="muted mobile-note">
            Global time clock entries are not tied to a specific job at punch-in.
          </div>
        </div>
      ) : !isEmployeeUser ? (
        <div class="card" style="margin-bottom:14px;">
          <div class="muted">
            Link your user to an employee record in <b>Users</b> to enable My Clock for your admin or manager account.
          </div>
        </div>
      ) : null}

      {!isEmployeeUser ? (
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
      ) : null}

      <div class="card" style="margin-top:14px;">
        <b>{isEmployeeUser ? 'My Entries' : 'Existing Entries'}</b>
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
              {existing.length > 0 ? (
                existing.map((t) => (
                  <tr>
                    <td>{t.date}</td>
                    <td>{t.job_name}</td>
                    <td>{t.entry_method}</td>
                    <td data-utc-display={t.clock_in_at || ''}>{t.clock_in_at || ''}</td>
                    <td data-utc-display={t.clock_out_at || ''}>{t.clock_out_at || ''}</td>
                    <td class="right">{t.hours}</td>
                    <td>
                      {t.approval_status === 'pending_edit' ? (
                        <span class="badge badge-warn">Pending Edit Approval</span>
                      ) : (
                        <span class="badge badge-good">Approved</span>
                      )}
                    </td>
                    <td class="muted">{t.note || ''}</td>
                    <td class="right">
                      {canRequestOwnEntryEdits && t.clock_in_at && t.clock_out_at ? (
                        <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                          <details style="display:inline-block; text-align:left; width:100%; max-width:420px;">
                            <summary class="btn edit-request-summary">Request Edit</summary>
                            <div class="card details-card" style="min-width:420px;">
                              <form
                                method="post"
                                action={`/timeclock/request-edit/${t.id}`}
                                data-time-submit
                              >
                                <input type="hidden" name="csrf_token" value={csrfToken} />

                                <label>Clock In</label>
                                <div class="edit-request-actions">
                                  <input
                                    id={`clock-in-local-${t.id}`}
                                    type="datetime-local"
                                    name="clock_in_local"
                                    data-utc-target="clock_in_utc"
                                    data-initial-utc={t.clock_in_at || ''}
                                    required
                                  />
                                  <button
                                    type="button"
                                    class="btn"
                                    data-fill-now={`clock-in-local-${t.id}`}
                                  >
                                    Now
                                  </button>
                                </div>
                                <input type="hidden" name="clock_in_utc" value="" />

                                <label>Clock Out</label>
                                <div class="edit-request-actions">
                                  <input
                                    id={`clock-out-local-${t.id}`}
                                    type="datetime-local"
                                    name="clock_out_local"
                                    data-utc-target="clock_out_utc"
                                    data-initial-utc={t.clock_out_at || ''}
                                    required
                                  />
                                  <button
                                    type="button"
                                    class="btn"
                                    data-fill-now={`clock-out-local-${t.id}`}
                                  >
                                    Now
                                  </button>
                                </div>
                                <input type="hidden" name="clock_out_utc" value="" />

                                <label>Note (optional)</label>
                                <input name="note" maxLength={500} value={t.note || ''} />

                                <label>Why are you requesting this edit?</label>
                                <textarea name="request_reason" required maxLength={500} />

                                <div class="actions actions-mobile-stack" style="margin-top:12px;">
                                  <button
                                    class="btn btn-primary"
                                    type="submit"
                                    disabled={t.has_pending_edit_request === 1}
                                  >
                                    {t.has_pending_edit_request === 1 ? 'Request Already Pending' : 'Submit Edit Request'}
                                  </button>
                                </div>
                              </form>
                            </div>
                          </details>

                          {!isEmployeeUser && canManageTimeEntries ? (
                            <form method="post" action={`/delete_time/${t.id}`} style="display:inline;">
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit">Delete</button>
                            </form>
                          ) : null}
                        </div>
                      ) : !isEmployeeUser && canManageTimeEntries ? (
                        <form method="post" action={`/delete_time/${t.id}`} style="display:inline;">
                          <input type="hidden" name="csrf_token" value={csrfToken} />
                          <button class="btn" type="submit">Delete</button>
                        </form>
                      ) : (
                        <span class="muted">View only</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
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
          {!canManageTimeEntries ? (
            <div class="muted" style="margin-top:8px;">
              You currently have view-only access for weekly timesheet entry management.
            </div>
          ) : null}
          <form method="post" action="/timesheet" style="margin-top:10px;" data-time-submit>
            <input type="hidden" name="csrf_token" value={csrfToken} />
            <input type="hidden" name="employee_id" value={String(employeeId || '')} />
            <input type="hidden" name="start" value={start} />

            <div class="muted small" style="margin:0 0 12px;">
              Add manual entries using actual time in and time out. Job assignment is optional for general labor time.
            </div>

            <div class="table-wrap table-wrap-tight">
              <table class="table">
                <thead>
                  <tr>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Job (optional)</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 7 }).map((_, index) => (
                    <tr>
                      <td>
                        <input
                          id={`manual-clock-in-${index}`}
                          type="datetime-local"
                          name="row_clock_in_local"
                          data-utc-target="row_clock_in_utc"
                          style="min-width:190px;"
                          disabled={!canManageTimeEntries}
                        />
                        <input type="hidden" name="row_clock_in_utc" value="" />
                      </td>
                      <td>
                        <div class="edit-request-actions">
                          <input
                            id={`manual-clock-out-${index}`}
                            type="datetime-local"
                            name="row_clock_out_local"
                            data-utc-target="row_clock_out_utc"
                            style="min-width:190px;"
                            disabled={!canManageTimeEntries}
                          />
                          <button
                            type="button"
                            class="btn"
                            data-fill-now={`manual-clock-out-${index}`}
                            disabled={!canManageTimeEntries}
                          >
                            Now
                          </button>
                        </div>
                        <input type="hidden" name="row_clock_out_utc" value="" />
                      </td>
                      <td>
                        <select name="row_job_id" style="min-width:180px;" disabled={!canManageTimeEntries}>
                          <option value="">Unassigned / General Time</option>
                          {jobs.map((j) => (
                            <option value={String(j.id)}>{j.job_name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input name="row_note" placeholder="Optional" maxLength={500} disabled={!canManageTimeEntries} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div class="actions actions-mobile-stack" style="margin-top:16px;">
              <button class="btn btn-primary" type="submit" disabled={!canManageTimeEntries || employees.length === 0}>
                Save Entries
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!isEmployeeUser ? (
        <div class="card" style="margin-top:14px;">
          <b>Pending Edit Requests</b>
          {!canApproveEditRequests ? (
            <div class="muted" style="margin-top:8px;">
              You can review pending requests here, but approval actions require additional permission.
            </div>
          ) : null}
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
                {pendingRequests.length > 0 ? (
                  pendingRequests.map((request) => (
                    <tr>
                      <td>{request.employee_name}</td>
                      <td>{request.original_job_name}</td>
                      <td>{request.job_name}</td>
                      <td>
                        <div data-utc-display={request.original_clock_in_at || ''}>
                          {request.original_clock_in_at || ''}
                        </div>
                        <div data-utc-display={request.original_clock_out_at || ''}>
                          {request.original_clock_out_at || ''}
                        </div>
                      </td>
                      <td>
                        <div data-utc-display={request.proposed_clock_in_at}>
                          {request.proposed_clock_in_at}
                        </div>
                        <div data-utc-display={request.proposed_clock_out_at}>
                          {request.proposed_clock_out_at}
                        </div>
                      </td>
                      <td>{request.request_reason}</td>
                      <td data-utc-display={request.created_at}>{request.created_at}</td>
                      <td class="right">
                        <div class="actions actions-mobile-stack" style="justify-content:flex-end;">
                          {canApproveEditRequests ? (<>
                            <form method="post" action={`/timeclock/edit-request/${request.id}/approve`}>
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn btn-primary" type="submit">Approve</button>
                            </form>
                            <form method="post" action={`/timeclock/edit-request/${request.id}/reject`}>
                              <input type="hidden" name="csrf_token" value={csrfToken} />
                              <button class="btn" type="submit">Reject</button>
                            </form>
                          </>) : (
                            <span class="muted">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
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