import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { loginRequired, roleRequired } from '../middleware/auth.js';
import { TimesheetPage } from '../pages/timesheet/TimesheetPage.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';

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

function loadExistingEntries(db: any, tenantId: number, employeeId: number | null, start: string) {
  if (!employeeId) return [];

  const dates = weekDates(start);

  return db.prepare(`
    SELECT t.id, t.date, t.job_id, j.job_name, t.hours, t.note
    FROM time_entries t
    JOIN jobs j ON j.id = t.job_id AND j.tenant_id = t.tenant_id
    WHERE t.employee_id = ? AND t.date BETWEEN ? AND ? AND t.tenant_id = ?
    ORDER BY t.date ASC, t.id ASC
  `).all(employeeId, dates[0], dates[6], tenantId) as Array<{
    id: number;
    date: string;
    job_id: number;
    job_name: string;
    hours: number;
    note: string | null;
  }>;
}

function renderTimesheetPage(
  c: any,
  options: {
    employees: Array<{ id: number; name: string }>;
    jobs: Array<{ id: number; job_name: string; client_name: string | null; status: string | null }>;
    employeeId: number | null;
    start: string;
    dates: string[];
    existing: Array<{ id: number; date: string; job_id: number; job_name: string; hours: number; note: string | null }>;
    error?: string;
    success?: string;
  },
  status: 200 | 400 = 200,
) {
  return renderApp(
    c,
    'Timesheets',
    <TimesheetPage
      employees={options.employees}
      jobs={options.jobs}
      employeeId={options.employeeId}
      start={options.start}
      dates={options.dates}
      existing={options.existing}
      csrfToken={c.get('csrfToken')}
      error={options.error}
      success={options.success}
    />,
    status,
  );
}

export const timesheetRoutes = new Hono<AppEnv>();

timesheetRoutes.get('/timesheet', loginRequired, (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;

  const db = getDb();
  const employees = loadEmployees(db, tenantId);
  const jobs = loadJobs(db, tenantId);

  const today = new Date().toISOString().slice(0, 10);
  const fallbackStart = weekStart(today);

  let employeeId: number | null = null;
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

  let start = fallbackStart;
  const requestedStart = c.req.query('start');
  if (requestedStart && isRealIsoDate(requestedStart)) {
    start = weekStart(requestedStart);
  }

  const dates = weekDates(start);
  const existing = loadExistingEntries(db, tenantId, employeeId, start);

  return renderTimesheetPage(c, {
    employees,
    jobs,
    employeeId,
    start,
    dates,
    existing,
  });
});

timesheetRoutes.post('/timesheet', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;

  const db = getDb();
  const body = await c.req.parseBody();

  const employees = loadEmployees(db, tenantId);
  const jobs = loadJobs(db, tenantId);

  let employeeId: number | null = null;
  let start = weekStart(new Date().toISOString().slice(0, 10));

  try {
    employeeId = normalizeEmployeeId(body['employee_id']);
    start = normalizeWeekStart(body['start']);

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

    const rate = hourlyEquivalent(employee.pay_type, employee.hourly_rate, employee.annual_salary);
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

      const job = db.prepare(`
        SELECT id
        FROM jobs
        WHERE id = ? AND tenant_id = ? AND COALESCE(status, 'Active') != 'Cancelled'
      `).get(jobId, tenantId) as { id: number } | undefined;

      if (!job) {
        throw new Error('One or more selected jobs were not found.');
      }

      const laborCost = Number((hours * rate).toFixed(2));

      db.prepare(`
        INSERT INTO time_entries (job_id, employee_id, date, hours, note, labor_cost, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(jobId, employeeId, rawDate, hours, note, laborCost, tenantId);

      insertedCount += 1;
    }

    const existing = loadExistingEntries(db, tenantId, employeeId, start);

    return renderTimesheetPage(c, {
      employees,
      jobs,
      employeeId,
      start,
      dates,
      existing,
      success: insertedCount > 0 ? 'Time entries saved successfully.' : 'No new time entries were added.',
    });
  } catch (error) {
    const dates = weekDates(start);
    const existing = loadExistingEntries(db, tenantId, employeeId, start);
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
        error: message,
      },
      400,
    );
  }
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

  db.prepare('DELETE FROM time_entries WHERE id = ? AND tenant_id = ?').run(timeId, tenantId);

  const referer = c.req.header('Referer') || '/timesheet';
  return c.redirect(referer);
});

export default timesheetRoutes;