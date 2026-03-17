import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import { TimesheetPage } from '../pages/timesheet/TimesheetPage.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';

function renderApp(c: any, subtitle: string, content: any, status: 200 | 400 = 200) {
  return c.html(
    <AppLayout
      currentTenant={c.get('tenant')}
      currentSubdomain={c.get('subdomain')}
      currentUser={c.get('user')}
      appName={process.env.APP_NAME || 'Hudson Business Solutions'}
      appLogo={process.env.APP_LOGO || '/static/brand/hudson-business-solutions-logo.png'}
      path={c.req.path}
      csrfToken={c.get('csrfToken')}
      subtitle={subtitle}
    >
      {content}
    </AppLayout>,
    status as any,
  );
}

function hourlyEquivalent(payType: string, hourlyRate: number | null, annualSalary: number | null): number {
  if ((payType || '').toLowerCase() === 'hourly') {
    return Number(hourlyRate || 0);
  }
  return Number(annualSalary || 0) / 2080;
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function isValidIsoDateTime(value: string): boolean {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && value.includes('T');
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function weekDates(mondayStr: string): string[] {
  const monday = new Date(`${mondayStr}T00:00:00Z`);
  const dates: string[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates;
}

function parsePositiveInt(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseHours(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0 || parsed > 24) return null;

  return Number(parsed.toFixed(2));
}

function normalizeWeekStart(value: unknown): string {
  const raw = String(value ?? '').trim();

  if (!isRealIsoDate(raw)) {
    throw new Error('Please select a valid week starting date.');
  }

  return weekStart(raw);
}

function normalizeEmployeeId(value: unknown): number {
  const employeeId = parsePositiveInt(value);
  if (!employeeId) {
    throw new Error('Please select a valid employee.');
  }
  return employeeId;
}

function normalizeNote(value: unknown): string | null {
  const note = String(value ?? '').trim();
  if (!note) return null;

  if (note.length > 500) {
    throw new Error('Notes must be 500 characters or less.');
  }

  return note;
}

function hoursBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end.getTime() - start.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    throw new Error('Clock out time must be after clock in time.');
  }

  const hours = diffMs / (1000 * 60 * 60);
  if (hours > 24) {
    throw new Error('A single entry cannot exceed 24 hours.');
  }

  return Number(hours.toFixed(2));
}

function loadEmployees(db: any, tenantId: number) {
  return db.prepare(`
    SELECT id, name
    FROM employees
    WHERE active = 1 AND tenant_id = ?
    ORDER BY name ASC
  `).all(tenantId) as Array<{ id: number; name: string }>;
}

function loadJobs(db: any, tenantId: number) {
  return db.prepare(`
    SELECT id, job_name, client_name, status
    FROM jobs
    WHERE tenant_id = ? AND COALESCE(status, 'Active') != 'Cancelled'
    ORDER BY job_name ASC
  `).all(tenantId) as Array<{ id: number; job_name: string; client_name: string | null; status: string | null }>;
}

function loadEmployeeForUser(db: any, userId: number, tenantId: number) {
  return db.prepare(`
    SELECT u.employee_id, e.name AS employee_name
    FROM users u
    LEFT JOIN employees e
      ON e.id = u.employee_id
     AND e.tenant_id = u.tenant_id
     AND e.active = 1
    WHERE u.id = ? AND u.tenant_id = ?
    LIMIT 1
  `).get(userId, tenantId) as { employee_id: number | null; employee_name: string | null } | undefined;
}

function displayJobName(jobName: string | null): string {
  return jobName || 'Unassigned / General Time';
}

function loadExistingEntries(db: any, tenantId: number, employeeId: number | null, start: string) {
  if (!employeeId) return [];

  const dates = weekDates(start);

  return db.prepare(`
    SELECT
      t.id,
      t.date,
      t.job_id,
      COALESCE(j.job_name, 'Unassigned / General Time') AS job_name,
      t.hours,
      t.note,
      t.clock_in_at,
      t.clock_out_at,
      t.entry_method,
      t.approval_status,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM time_entry_edit_requests r
          WHERE r.time_entry_id = t.id
            AND r.tenant_id = t.tenant_id
            AND r.status = 'pending'
        )
        THEN 1
        ELSE 0
      END AS has_pending_edit_request
    FROM time_entries t
    LEFT JOIN jobs j
      ON j.id = t.job_id
     AND j.tenant_id = t.tenant_id
    WHERE t.employee_id = ? AND t.date BETWEEN ? AND ? AND t.tenant_id = ?
    ORDER BY t.date ASC, t.id ASC
  `).all(employeeId, dates[0], dates[6], tenantId) as Array<{
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
    has_pending_edit_request: number;
  }>;
}

function loadPendingRequests(db: any, tenantId: number) {
  return db.prepare(`
    SELECT
      r.id,
      e.name AS employee_name,
      COALESCE(pj.job_name, 'Unassigned / General Time') AS job_name,
      COALESCE(oj.job_name, 'Unassigned / General Time') AS original_job_name,
      t.clock_in_at AS original_clock_in_at,
      t.clock_out_at AS original_clock_out_at,
      r.proposed_clock_in_at,
      r.proposed_clock_out_at,
      r.request_reason,
      r.created_at
    FROM time_entry_edit_requests r
    JOIN employees e ON e.id = r.employee_id AND e.tenant_id = r.tenant_id
    LEFT JOIN jobs pj ON pj.id = r.proposed_job_id AND pj.tenant_id = r.tenant_id
    JOIN time_entries t ON t.id = r.time_entry_id AND t.tenant_id = r.tenant_id
    LEFT JOIN jobs oj ON oj.id = t.job_id AND oj.tenant_id = t.tenant_id
    WHERE r.tenant_id = ? AND r.status = 'pending'
    ORDER BY r.created_at ASC, r.id ASC
  `).all(tenantId) as Array<{
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
  }>;
}

function loadActiveClockEntry(db: any, tenantId: number, employeeId: number | null) {
  if (!employeeId) return null;

  return db.prepare(`
    SELECT
      t.id,
      t.job_id,
      COALESCE(j.job_name, 'General Time') AS job_name,
      t.clock_in_at
    FROM time_entries t
    LEFT JOIN jobs j
      ON j.id = t.job_id
     AND j.tenant_id = t.tenant_id
    WHERE t.tenant_id = ?
      AND t.employee_id = ?
      AND t.entry_method = 'clock'
      AND t.clock_in_at IS NOT NULL
      AND t.clock_out_at IS NULL
    ORDER BY t.id DESC
    LIMIT 1
  `).get(tenantId, employeeId) as
    | { id: number; job_id: number | null; job_name: string; clock_in_at: string }
    | null;
}

function renderTimesheetPage(
  c: any,
  options: {
    employees: Array<{ id: number; name: string }>;
    jobs: Array<{ id: number; job_name: string; client_name: string | null; status: string | null }>;
    employeeId: number | null;
    start: string;
    dates: string[];
    existing: Array<{
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
    }>;
    pendingRequests: Array<{
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
    }>;
    currentEmployeeContext?: { employeeId: number; employeeName: string } | null;
    activeClockEntry?: { id: number; job_id: number | null; job_name: string; clock_in_at: string } | null;
    isEmployeeUser: boolean;
    canUseSelfClock: boolean;
    error?: string;
    success?: string;
  },
  status: 200 | 400 = 200,
) {
  return renderApp(
    c,
    options.isEmployeeUser ? 'Time Clock' : 'Timesheets',
    <TimesheetPage
      employees={options.employees}
      jobs={options.jobs}
      employeeId={options.employeeId}
      start={options.start}
      dates={options.dates}
      existing={options.existing}
      pendingRequests={options.pendingRequests}
      currentEmployeeContext={options.currentEmployeeContext}
      activeClockEntry={options.activeClockEntry}
      isEmployeeUser={options.isEmployeeUser}
      canUseSelfClock={options.canUseSelfClock}
      csrfToken={c.get('csrfToken')}
      error={options.error}
      success={options.success}
    />,
    status,
  );
}

function getEmployeeRate(db: any, employeeId: number, tenantId: number) {
  const employee = db.prepare(`
    SELECT id, pay_type, hourly_rate, annual_salary
    FROM employees
    WHERE id = ? AND tenant_id = ? AND active = 1
  `).get(employeeId, tenantId) as
    | { id: number; pay_type: string; hourly_rate: number | null; annual_salary: number | null }
    | undefined;

  if (!employee) {
    throw new Error('Selected employee was not found.');
  }

  return hourlyEquivalent(employee.pay_type, employee.hourly_rate, employee.annual_salary);
}

function ensureJobExists(db: any, jobId: number, tenantId: number) {
  const job = db.prepare(`
    SELECT id
    FROM jobs
    WHERE id = ? AND tenant_id = ? AND COALESCE(status, 'Active') != 'Cancelled'
  `).get(jobId, tenantId) as { id: number } | undefined;

  if (!job) {
    throw new Error('Selected job was not found.');
  }
}

export const timesheetRoutes = new Hono<AppEnv>();

timesheetRoutes.get('/timesheet', loginRequired, (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');
  const tenantId = tenant.id;

  const db = getDb();
  const employees = loadEmployees(db, tenantId);
  const jobs = loadJobs(db, tenantId);

  const isEmployeeUser = currentUser.role === 'Employee';
  const link = loadEmployeeForUser(db, currentUser.id, tenantId);
  const canUseSelfClock = !!(link?.employee_id && link?.employee_name);

  const today = new Date().toISOString().slice(0, 10);
  const fallbackStart = weekStart(today);

  let employeeId: number | null = null;
  let currentEmployeeContext: { employeeId: number; employeeName: string } | null = null;

  if (canUseSelfClock && link?.employee_id && link?.employee_name) {
    currentEmployeeContext = {
      employeeId: link.employee_id,
      employeeName: link.employee_name,
    };
  }

  if (isEmployeeUser) {
    employeeId = link?.employee_id ?? null;
  } else {
    const requestedEmployeeId = c.req.query('employee_id');

    if (requestedEmployeeId) {
      employeeId = parsePositiveInt(requestedEmployeeId);
    } else if (employees.length > 0) {
      employeeId = employees[0].id;
    }

    if (employeeId !== null) {
      const employeeExists = employees.some((employee) => employee.id === employeeId);
      if (!employeeExists) {
        employeeId = employees.length > 0 ? employees[0].id : null;
      }
    }
  }

  let start = fallbackStart;
  const requestedStart = c.req.query('start');
  if (requestedStart && isRealIsoDate(requestedStart)) {
    start = weekStart(requestedStart);
  }

  const dates = weekDates(start);
  const existing = loadExistingEntries(db, tenantId, employeeId, start);
  const pendingRequests = isEmployeeUser ? [] : loadPendingRequests(db, tenantId);
  const activeClockEntry = canUseSelfClock
    ? loadActiveClockEntry(db, tenantId, link?.employee_id ?? null)
    : null;

  if (isEmployeeUser && !employeeId) {
    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId: null,
      start,
      dates,
      existing: [],
      pendingRequests: [],
      currentEmployeeContext: null,
      activeClockEntry: null,
      isEmployeeUser,
      canUseSelfClock: false,
      error: 'Your user account is not linked to an employee record yet. Ask an Admin to link your user to an employee profile.',
    });
  }

  return renderTimesheetPage(c, {
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
  });
});

timesheetRoutes.post('/timesheet', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');
  const tenantId = tenant.id;

  const db = getDb();
  const body = await c.req.parseBody();

  const employees = loadEmployees(db, tenantId);
  const jobs = loadJobs(db, tenantId);
  const link = loadEmployeeForUser(db, currentUser.id, tenantId);
  const canUseSelfClock = !!(link?.employee_id && link?.employee_name);

  let employeeId: number | null = null;
  let start = weekStart(new Date().toISOString().slice(0, 10));

  try {
    employeeId = normalizeEmployeeId(body['employee_id']);
    start = normalizeWeekStart(body['start']);

    const rate = getEmployeeRate(db, employeeId, tenantId);
    const dates = weekDates(start);
    const allowedDates = new Set(dates);

    const rowDate = Array.isArray(body['row_date']) ? body['row_date'] : [body['row_date']];
    const rowJobId = Array.isArray(body['row_job_id']) ? body['row_job_id'] : [body['row_job_id']];
    const rowHours = Array.isArray(body['row_hours']) ? body['row_hours'] : [body['row_hours']];
    const rowNote = Array.isArray(body['row_note']) ? body['row_note'] : [body['row_note']];

    let insertedCount = 0;

    for (let i = 0; i < rowDate.length; i++) {
      const rawDate = String(rowDate[i] ?? '').trim();
      const rawJobId = String(rowJobId[i] ?? '').trim();
      const rawHours = String(rowHours[i] ?? '').trim();

      if (!rawJobId && (!rawHours || rawHours === '0')) {
        continue;
      }

      if (!isRealIsoDate(rawDate) || !allowedDates.has(rawDate)) {
        throw new Error('One or more entry dates are invalid for the selected week.');
      }

      const jobId = parsePositiveInt(rawJobId);
      if (!jobId) {
        throw new Error('Please select a valid job for each entered row.');
      }

      const hours = parseHours(rawHours);
      if (hours === null) {
        throw new Error('Hours must be greater than 0 and no more than 24 for each row.');
      }

      const note = normalizeNote(rowNote[i]);

      ensureJobExists(db, jobId, tenantId);

      const laborCost = Number((hours * rate).toFixed(2));

      db.prepare(`
        INSERT INTO time_entries (
          job_id, employee_id, date, hours, note, labor_cost, tenant_id,
          entry_method, approval_status, approved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 'approved', CURRENT_TIMESTAMP)
      `).run(jobId, employeeId, rawDate, hours, note, laborCost, tenantId);

      insertedCount += 1;
    }

    const existing = loadExistingEntries(db, tenantId, employeeId, start);
    const pendingRequests = loadPendingRequests(db, tenantId);
    const currentEmployeeContext = canUseSelfClock && link?.employee_id && link?.employee_name
      ? { employeeId: link.employee_id, employeeName: link.employee_name }
      : null;
    const activeClockEntry = canUseSelfClock
      ? loadActiveClockEntry(db, tenantId, link?.employee_id ?? null)
      : null;

    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId,
      start,
      dates,
      existing,
      pendingRequests,
      currentEmployeeContext,
      activeClockEntry,
      isEmployeeUser: false,
      canUseSelfClock,
      success: insertedCount > 0 ? 'Time entries saved successfully.' : 'No new time entries were added.',
    });
  } catch (error) {
    const dates = weekDates(start);
    const existing = loadExistingEntries(db, tenantId, employeeId, start);
    const pendingRequests = loadPendingRequests(db, tenantId);
    const currentEmployeeContext = canUseSelfClock && link?.employee_id && link?.employee_name
      ? { employeeId: link.employee_id, employeeName: link.employee_name }
      : null;
    const activeClockEntry = canUseSelfClock
      ? loadActiveClockEntry(db, tenantId, link?.employee_id ?? null)
      : null;
    const message = error instanceof Error ? error.message : 'Unable to save time entries.';

    return renderTimesheetPage(
      c,
      {
        employees,
        jobs,
        employeeId,
        start,
        dates,
        existing,
        pendingRequests,
        currentEmployeeContext,
        activeClockEntry,
        isEmployeeUser: false,
        canUseSelfClock,
        error: message,
      },
      400,
    );
  }
});

timesheetRoutes.post('/timeclock/punch-in', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const link = loadEmployeeForUser(db, currentUser.id, tenant.id);
  const employees = loadEmployees(db, tenant.id);
  const jobs = loadJobs(db, tenant.id);
  const today = toIsoDate(new Date());
  const start = weekStart(today);
  const dates = weekDates(start);
  const canUseSelfClock = !!(link?.employee_id && link?.employee_name);

  try {
    const employeeId = link?.employee_id ?? null;
    if (!employeeId) {
      throw new Error('Your user account is not linked to an employee record.');
    }

    const activeClockEntry = loadActiveClockEntry(db, tenant.id, employeeId);
    if (activeClockEntry) {
      throw new Error('You are already clocked in.');
    }

    const body = await c.req.parseBody();
    const nowUtc = String(body['client_now_utc'] ?? '').trim();
    const note = normalizeNote(body['note']);

    if (!isValidIsoDateTime(nowUtc)) {
      throw new Error('Invalid punch in timestamp.');
    }

    db.prepare(`
      INSERT INTO time_entries (
        job_id, employee_id, date, hours, note, labor_cost, tenant_id,
        clock_in_at, clock_out_at, entry_method, approval_status, approved_by_user_id, approved_at
      )
      VALUES (NULL, ?, ?, 0, ?, 0, ?, ?, NULL, 'clock', 'approved', ?, CURRENT_TIMESTAMP)
    `).run(employeeId, toIsoDate(new Date(nowUtc)), note, tenant.id, nowUtc, currentUser.id);

    const currentEmployeeContext = link?.employee_name
      ? { employeeId, employeeName: link.employee_name }
      : null;

    const existing = currentUser.role === 'Employee'
      ? loadExistingEntries(db, tenant.id, employeeId, start)
      : loadExistingEntries(db, tenant.id, employees.length > 0 ? employees[0].id : null, start);

    const pendingRequests = currentUser.role === 'Employee' ? [] : loadPendingRequests(db, tenant.id);

    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId: currentUser.role === 'Employee'
        ? employeeId
        : (employees.length > 0 ? employees[0].id : null),
      start,
      dates,
      existing,
      pendingRequests,
      currentEmployeeContext,
      activeClockEntry: loadActiveClockEntry(db, tenant.id, employeeId),
      isEmployeeUser: currentUser.role === 'Employee',
      canUseSelfClock,
      success: 'You are now clocked in.',
    });
  } catch (error) {
    const employeeId = link?.employee_id ?? null;
    const currentEmployeeContext = link?.employee_id && link?.employee_name
      ? { employeeId: link.employee_id, employeeName: link.employee_name }
      : null;

    const selectedAdminEmployeeId =
      currentUser.role === 'Employee'
        ? employeeId
        : (employees.length > 0 ? employees[0].id : null);

    const existing = loadExistingEntries(db, tenant.id, selectedAdminEmployeeId, start);
    const pendingRequests = currentUser.role === 'Employee' ? [] : loadPendingRequests(db, tenant.id);

    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId: selectedAdminEmployeeId,
      start,
      dates,
      existing,
      pendingRequests,
      currentEmployeeContext,
      activeClockEntry: loadActiveClockEntry(db, tenant.id, employeeId),
      isEmployeeUser: currentUser.role === 'Employee',
      canUseSelfClock,
      error: error instanceof Error ? error.message : 'Unable to punch in.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/punch-out', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const link = loadEmployeeForUser(db, currentUser.id, tenant.id);
  const employees = loadEmployees(db, tenant.id);
  const jobs = loadJobs(db, tenant.id);
  const today = toIsoDate(new Date());
  const start = weekStart(today);
  const dates = weekDates(start);
  const employeeId = link?.employee_id ?? null;
  const canUseSelfClock = !!(link?.employee_id && link?.employee_name);

  try {
    if (!employeeId) {
      throw new Error('Your user account is not linked to an employee record.');
    }

    const activeClockEntry = loadActiveClockEntry(db, tenant.id, employeeId);
    if (!activeClockEntry) {
      throw new Error('You are not currently clocked in.');
    }

    const body = await c.req.parseBody();
    const nowUtc = String(body['client_now_utc'] ?? '').trim();

    if (!isValidIsoDateTime(nowUtc)) {
      throw new Error('Invalid punch out timestamp.');
    }

    const hours = hoursBetween(activeClockEntry.clock_in_at, nowUtc);
    const rate = getEmployeeRate(db, employeeId, tenant.id);
    const laborCost = Number((hours * rate).toFixed(2));

    db.prepare(`
      UPDATE time_entries
      SET clock_out_at = ?,
          date = ?,
          hours = ?,
          labor_cost = ?,
          approved_by_user_id = ?,
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(
      nowUtc,
      toIsoDate(new Date(activeClockEntry.clock_in_at)),
      hours,
      laborCost,
      currentUser.id,
      activeClockEntry.id,
      tenant.id,
    );

    const currentEmployeeContext = link?.employee_name
      ? { employeeId, employeeName: link.employee_name }
      : null;

    const existing = currentUser.role === 'Employee'
      ? loadExistingEntries(db, tenant.id, employeeId, start)
      : loadExistingEntries(db, tenant.id, employees.length > 0 ? employees[0].id : null, start);

    const pendingRequests = currentUser.role === 'Employee' ? [] : loadPendingRequests(db, tenant.id);

    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId: currentUser.role === 'Employee'
        ? employeeId
        : (employees.length > 0 ? employees[0].id : null),
      start,
      dates,
      existing,
      pendingRequests,
      currentEmployeeContext,
      activeClockEntry: null,
      isEmployeeUser: currentUser.role === 'Employee',
      canUseSelfClock,
      success: 'You have been clocked out successfully.',
    });
  } catch (error) {
    const currentEmployeeContext = link?.employee_id && link?.employee_name
      ? { employeeId: link.employee_id, employeeName: link.employee_name }
      : null;

    const selectedAdminEmployeeId =
      currentUser.role === 'Employee'
        ? employeeId
        : (employees.length > 0 ? employees[0].id : null);

    const existing = loadExistingEntries(db, tenant.id, selectedAdminEmployeeId, start);
    const pendingRequests = currentUser.role === 'Employee' ? [] : loadPendingRequests(db, tenant.id);

    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId: selectedAdminEmployeeId,
      start,
      dates,
      existing,
      pendingRequests,
      currentEmployeeContext,
      activeClockEntry: loadActiveClockEntry(db, tenant.id, employeeId),
      isEmployeeUser: currentUser.role === 'Employee',
      canUseSelfClock,
      error: error instanceof Error ? error.message : 'Unable to punch out.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/request-edit/:id', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const link = loadEmployeeForUser(db, currentUser.id, tenant.id);
  const employees = loadEmployees(db, tenant.id);
  const jobs = loadJobs(db, tenant.id);
  const today = toIsoDate(new Date());
  const start = weekStart(today);
  const dates = weekDates(start);
  const employeeId = link?.employee_id ?? null;
  const canUseSelfClock = !!(link?.employee_id && link?.employee_name);

  try {
    if (!employeeId) {
      throw new Error('Your user account is not linked to an employee record.');
    }

    const timeEntryId = parsePositiveInt(c.req.param('id'));
    if (!timeEntryId) {
      throw new Error('Time entry not found.');
    }

    const existingEntry = db.prepare(`
      SELECT id, job_id, note, clock_in_at, clock_out_at
      FROM time_entries
      WHERE id = ? AND tenant_id = ? AND employee_id = ?
    `).get(timeEntryId, tenant.id, employeeId) as
      | { id: number; job_id: number | null; note: string | null; clock_in_at: string | null; clock_out_at: string | null }
      | undefined;

    if (!existingEntry) {
      throw new Error('Time entry not found.');
    }

    const existingPending = db.prepare(`
      SELECT id
      FROM time_entry_edit_requests
      WHERE tenant_id = ? AND time_entry_id = ? AND status = 'pending'
      LIMIT 1
    `).get(tenant.id, timeEntryId) as { id: number } | undefined;

    if (existingPending) {
      throw new Error('There is already a pending edit request for this time entry.');
    }

    const body = await c.req.parseBody();
    const clockInUtc = String(body['clock_in_utc'] ?? '').trim();
    const clockOutUtc = String(body['clock_out_utc'] ?? '').trim();
    const note = normalizeNote(body['note']);
    const requestReason = String(body['request_reason'] ?? '').trim();

    if (!requestReason || requestReason.length > 500) {
      throw new Error('Please provide a brief reason for this edit request (500 characters max).');
    }

    if (!isValidIsoDateTime(clockInUtc) || !isValidIsoDateTime(clockOutUtc)) {
      throw new Error('Please provide valid edited clock times.');
    }

    const hours = hoursBetween(clockInUtc, clockOutUtc);
    const proposedDate = toIsoDate(new Date(clockInUtc));

    db.prepare(`
      INSERT INTO time_entry_edit_requests (
        tenant_id,
        time_entry_id,
        employee_id,
        requested_by_user_id,
        proposed_job_id,
        proposed_date,
        proposed_clock_in_at,
        proposed_clock_out_at,
        proposed_hours,
        proposed_note,
        request_reason,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      tenant.id,
      timeEntryId,
      employeeId,
      currentUser.id,
      existingEntry.job_id,
      proposedDate,
      clockInUtc,
      clockOutUtc,
      hours,
      note,
      requestReason,
    );

    db.prepare(`
      UPDATE time_entries
      SET approval_status = 'pending_edit'
      WHERE id = ? AND tenant_id = ?
    `).run(timeEntryId, tenant.id);
    
    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: currentUser.id,
      eventType: 'time.edit_requested',
      entityType: 'time_entry',
      entityId: timeEntryId,
      description: `${currentUser.name} requested a time edit for entry #${timeEntryId}.`,
      metadata: {
        employee_id: employeeId,
        proposed_date: proposedDate,
        proposed_clock_in_at: clockInUtc,
        proposed_clock_out_at: clockOutUtc,
        proposed_hours: hours,
        proposed_note: note,
        request_reason: requestReason,
      },
      ipAddress: resolveRequestIp(c),
    });

    const currentEmployeeContext = link?.employee_name
      ? { employeeId, employeeName: link.employee_name }
      : null;

    const existing = currentUser.role === 'Employee'
      ? loadExistingEntries(db, tenant.id, employeeId, start)
      : loadExistingEntries(db, tenant.id, employees.length > 0 ? employees[0].id : null, start);

    const pendingRequests = currentUser.role === 'Employee' ? [] : loadPendingRequests(db, tenant.id);

    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId: currentUser.role === 'Employee'
        ? employeeId
        : (employees.length > 0 ? employees[0].id : null),
      start,
      dates,
      existing,
      pendingRequests,
      currentEmployeeContext,
      activeClockEntry: loadActiveClockEntry(db, tenant.id, employeeId),
      isEmployeeUser: currentUser.role === 'Employee',
      canUseSelfClock,
      success: 'Your edit request has been submitted for approval.',
    });
  } catch (error) {
    const currentEmployeeContext = link?.employee_id && link?.employee_name
      ? { employeeId: link.employee_id, employeeName: link.employee_name }
      : null;

    const selectedAdminEmployeeId =
      currentUser.role === 'Employee'
        ? employeeId
        : (employees.length > 0 ? employees[0].id : null);

    const existing = loadExistingEntries(db, tenant.id, selectedAdminEmployeeId, start);
    const pendingRequests = currentUser.role === 'Employee' ? [] : loadPendingRequests(db, tenant.id);

    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId: selectedAdminEmployeeId,
      start,
      dates,
      existing,
      pendingRequests,
      currentEmployeeContext,
      activeClockEntry: loadActiveClockEntry(db, tenant.id, employeeId),
      isEmployeeUser: currentUser.role === 'Employee',
      canUseSelfClock,
      error: error instanceof Error ? error.message : 'Unable to submit edit request.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/edit-request/:id/approve', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const requestId = parsePositiveInt(c.req.param('id'));
  if (!requestId) {
    return c.text('Edit request not found', 404);
  }

  const db = getDb();

  const request = db.prepare(`
    SELECT
      r.id,
      r.time_entry_id,
      r.employee_id,
      r.proposed_job_id,
      r.proposed_date,
      r.proposed_clock_in_at,
      r.proposed_clock_out_at,
      r.proposed_hours,
      r.proposed_note
    FROM time_entry_edit_requests r
    WHERE r.id = ? AND r.tenant_id = ? AND r.status = 'pending'
    LIMIT 1
  `).get(requestId, tenant.id) as
    | {
        id: number;
        time_entry_id: number;
        employee_id: number;
        proposed_job_id: number | null;
        proposed_date: string;
        proposed_clock_in_at: string;
        proposed_clock_out_at: string;
        proposed_hours: number;
        proposed_note: string | null;
      }
    | undefined;

  if (!request) {
    return c.text('Edit request not found', 404);
  }

  const rate = getEmployeeRate(db, request.employee_id, tenant.id);
  const laborCost = Number((request.proposed_hours * rate).toFixed(2));

  db.prepare(`
    UPDATE time_entries
    SET job_id = ?,
        date = ?,
        clock_in_at = ?,
        clock_out_at = ?,
        hours = ?,
        labor_cost = ?,
        note = ?,
        approval_status = 'approved',
        approved_by_user_id = ?,
        approved_at = CURRENT_TIMESTAMP,
        last_edited_by_user_id = ?,
        last_edited_at = CURRENT_TIMESTAMP,
        edit_reason = 'Approved employee edit request'
    WHERE id = ? AND tenant_id = ?
  `).run(
    request.proposed_job_id,
    request.proposed_date,
    request.proposed_clock_in_at,
    request.proposed_clock_out_at,
    request.proposed_hours,
    laborCost,
    request.proposed_note,
    currentUser.id,
    currentUser.id,
    request.time_entry_id,
    tenant.id,
  );

  db.prepare(`
    UPDATE time_entry_edit_requests
    SET status = 'approved',
        reviewed_by_user_id = ?,
        reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(currentUser.id, requestId, tenant.id);

  logActivity(db, {
    tenantId: tenant.id,
    actorUserId: currentUser.id,
    eventType: 'time.edit_approved',
    entityType: 'time_entry',
    entityId: request.time_entry_id,
    description: `${currentUser.name} approved a time edit for entry #${request.time_entry_id}.`,
    metadata: {
      request_id: requestId,
      employee_id: request.employee_id,
      proposed_job_id: request.proposed_job_id,
      proposed_date: request.proposed_date,
      proposed_clock_in_at: request.proposed_clock_in_at,
      proposed_clock_out_at: request.proposed_clock_out_at,
      proposed_hours: request.proposed_hours,
      proposed_note: request.proposed_note,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/timesheet');
});

timesheetRoutes.post('/timeclock/edit-request/:id/reject', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const requestId = parsePositiveInt(c.req.param('id'));
  if (!requestId) {
    return c.text('Edit request not found', 404);
  }

  const db = getDb();

  const request = db.prepare(`
    SELECT id, time_entry_id
    FROM time_entry_edit_requests
    WHERE id = ? AND tenant_id = ? AND status = 'pending'
    LIMIT 1
  `).get(requestId, tenant.id) as { id: number; time_entry_id: number } | undefined;

  if (!request) {
    return c.text('Edit request not found', 404);
  }

  db.prepare(`
    UPDATE time_entry_edit_requests
    SET status = 'rejected',
        reviewed_by_user_id = ?,
        reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(currentUser.id, requestId, tenant.id);

  db.prepare(`
    UPDATE time_entries
    SET approval_status = 'approved'
    WHERE id = ? AND tenant_id = ?
  `).run(request.time_entry_id, tenant.id);

  logActivity(db, {
    tenantId: tenant.id,
    actorUserId: currentUser.id,
    eventType: 'time.edit_rejected',
    entityType: 'time_entry',
    entityId: request.time_entry_id,
    description: `${currentUser.name} rejected a time edit for entry #${request.time_entry_id}.`,
    metadata: {
      request_id: requestId,
      time_entry_id: request.time_entry_id,
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/timesheet');
});

timesheetRoutes.post('/delete_time/:id', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;

  const timeId = parsePositiveInt(c.req.param('id'));
  if (!timeId) {
    return c.text('Time entry not found', 404);
  }

  const db = getDb();

  const entry = db.prepare(`
    SELECT id
    FROM time_entries
    WHERE id = ? AND tenant_id = ?
  `).get(timeId, tenantId) as { id: number } | undefined;

  if (!entry) {
    return c.text('Time entry not found', 404);
  }

  db.prepare('DELETE FROM time_entry_edit_requests WHERE time_entry_id = ? AND tenant_id = ?').run(timeId, tenantId);
  db.prepare('DELETE FROM time_entries WHERE id = ? AND tenant_id = ?').run(timeId, tenantId);

  const referer = c.req.header('Referer') || '/timesheet';
  return c.redirect(referer);
});

export default timesheetRoutes;