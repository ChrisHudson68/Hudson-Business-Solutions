import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { permissionRequired, roleRequired, userHasPermission } from '../middleware/auth.js';
import { TimesheetPage } from '../pages/timesheet/TimesheetPage.js';
import { AdminWeeklyHoursPage } from '../pages/timesheet/AdminWeeklyHoursPage.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { generateWeeklyHoursPdf } from '../services/timesheet-weekly-hours-pdf.js';

interface EmployeeOption {
  id: number;
  name: string;
}

interface JobOption {
  id: number;
  job_name: string;
  client_name: string | null;
  status: string | null;
}

interface ExistingEntry {
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
}

interface PendingRequestSummary {
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

interface TimesheetViewState {
  employees: EmployeeOption[];
  jobs: JobOption[];
  employeeId: number | null;
  start: string;
  dates: string[];
  existing: ExistingEntry[];
  pendingRequests: PendingRequestSummary[];
  currentEmployeeContext: CurrentEmployeeContext | null;
  activeClockEntry: ActiveClockEntry | null;
  isEmployeeUser: boolean;
  canUseSelfClock: boolean;
  canRequestEdits: boolean;
  canManageTimeEntries: boolean;
  canApproveEditRequests: boolean;
  weekApproval: WeekApproval | null;
  weekCalendar: CalendarWeekSummary[];
  selectedWeekHours: number;
  selectedWeekEntryCount: number;
  pendingWeekEditRequestCount: number;
  openClockEntryCount: number;
  selectedWeekLabel: string;
  prevWeekStart: string;
  nextWeekStart: string;
}

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

interface AdminHoursDetailEntry {
  employee_id: number;
  employee_name: string;
  date: string;
  job_name: string;
  hours: number;
  clock_in_at: string | null;
  clock_out_at: string | null;
  entry_method: string;
  note: string | null;
  lunch_deduction_exempt: number;
}

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

function parseBooleanFlag(value: unknown): number {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes' ? 1 : 0;
}

function applyAutomaticLunchDeduction(hours: number, lunchDeductionExempt: boolean): number {
  if (lunchDeductionExempt) {
    return Number(hours.toFixed(2));
  }

  if (hours >= 6) {
    return Number(Math.max(hours - 1, 0).toFixed(2));
  }

  return Number(hours.toFixed(2));
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
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

function weekRangeLabel(mondayStr: string): string {
  const dates = weekDates(mondayStr);
  return `${dates[0]} to ${dates[6]}`;
}

function parsePositiveInt(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseLocalTime(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return /^\d{2}:\d{2}$/.test(raw) ? raw : null;
}

function bodyValues(body: Record<string, unknown>, key: string): unknown[] {
  const value = body[key];
  return Array.isArray(value) ? value : [value];
}

function localDateTimeToUtc(dateStr: string, timeStr: string): string {
  const local = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(local.getTime())) {
    throw new Error('One or more manual entry times are invalid.');
  }
  return local.toISOString();
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

function resolveClientNowUtc(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (isValidIsoDateTime(raw)) {
    return raw;
  }
  return new Date().toISOString();
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

function loadEmployees(db: any, tenantId: number): EmployeeOption[] {
  return db.prepare(`
    SELECT id, name
    FROM employees
    WHERE active = 1 AND tenant_id = ?
    ORDER BY name ASC
  `).all(tenantId) as EmployeeOption[];
}

function loadJobs(db: any, tenantId: number): JobOption[] {
  return db.prepare(`
    SELECT id, job_name, client_name, status
    FROM jobs
    WHERE tenant_id = ? AND COALESCE(status, 'Active') != 'Cancelled'
    ORDER BY job_name ASC
  `).all(tenantId) as JobOption[];
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

function getEmployeeCompensationSettings(db: any, employeeId: number, tenantId: number) {
  const employee = db.prepare(`
    SELECT id, pay_type, hourly_rate, annual_salary, COALESCE(lunch_deduction_exempt, 0) AS lunch_deduction_exempt
    FROM employees
    WHERE id = ? AND tenant_id = ? AND active = 1
  `).get(employeeId, tenantId) as
    | {
        id: number;
        pay_type: string;
        hourly_rate: number | null;
        annual_salary: number | null;
        lunch_deduction_exempt: number;
      }
    | undefined;

  if (!employee) {
    throw new Error('Selected employee was not found.');
  }

  return {
    rate: hourlyEquivalent(employee.pay_type, employee.hourly_rate, employee.annual_salary),
    lunchDeductionExempt: Number(employee.lunch_deduction_exempt || 0) === 1,
  };
}

function loadExistingEntries(db: any, tenantId: number, employeeId: number | null, start: string): ExistingEntry[] {
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
    ORDER BY t.date ASC, t.clock_in_at ASC, t.id ASC
  `).all(employeeId, dates[0], dates[6], tenantId) as ExistingEntry[];
}

function loadPendingRequests(db: any, tenantId: number): PendingRequestSummary[] {
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
  `).all(tenantId) as PendingRequestSummary[];
}

function loadActiveClockEntry(db: any, tenantId: number, employeeId: number | null): ActiveClockEntry | null {
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
  `).get(tenantId, employeeId) as ActiveClockEntry | null;
}

function loadWeekApproval(db: any, tenantId: number, employeeId: number | null, start: string): WeekApproval | null {
  if (!employeeId) return null;

  return db.prepare(`
    SELECT
      w.id,
      w.employee_id,
      w.week_start,
      w.approved_at,
      w.note,
      w.approved_by_user_id,
      u.name AS approved_by_name
    FROM time_entry_week_approvals w
    LEFT JOIN users u ON u.id = w.approved_by_user_id AND u.tenant_id = w.tenant_id
    WHERE w.tenant_id = ? AND w.employee_id = ? AND w.week_start = ?
    LIMIT 1
  `).get(tenantId, employeeId, start) as WeekApproval | null;
}

function countPendingWeekEditRequests(db: any, tenantId: number, employeeId: number | null, start: string): number {
  if (!employeeId) return 0;
  const dates = weekDates(start);

  const row = db.prepare(`
    SELECT COUNT(*) AS total
    FROM time_entry_edit_requests r
    WHERE r.tenant_id = ?
      AND r.employee_id = ?
      AND r.status = 'pending'
      AND r.proposed_date BETWEEN ? AND ?
  `).get(tenantId, employeeId, dates[0], dates[6]) as { total: number };

  return Number(row?.total || 0);
}

function countOpenClockEntriesForWeek(db: any, tenantId: number, employeeId: number | null, start: string): number {
  if (!employeeId) return 0;
  const dates = weekDates(start);

  const row = db.prepare(`
    SELECT COUNT(*) AS total
    FROM time_entries
    WHERE tenant_id = ?
      AND employee_id = ?
      AND date BETWEEN ? AND ?
      AND clock_in_at IS NOT NULL
      AND clock_out_at IS NULL
  `).get(tenantId, employeeId, dates[0], dates[6]) as { total: number };

  return Number(row?.total || 0);
}

function loadWeekCalendar(db: any, tenantId: number, employeeId: number | null, selectedStart: string): CalendarWeekSummary[] {
  if (!employeeId) return [];

  const firstWeek = addDays(selectedStart, -7 * 11);
  const lastWeek = addDays(selectedStart, 7 * 4);
  const lastWeekEnd = addDays(lastWeek, 6);

  const entryRows = db.prepare(`
    SELECT date, hours
    FROM time_entries
    WHERE tenant_id = ?
      AND employee_id = ?
      AND date BETWEEN ? AND ?
  `).all(tenantId, employeeId, firstWeek, lastWeekEnd) as Array<{ date: string; hours: number }>;

  const approvalRows = db.prepare(`
    SELECT w.week_start, w.approved_at, u.name AS approved_by_name
    FROM time_entry_week_approvals w
    LEFT JOIN users u ON u.id = w.approved_by_user_id AND u.tenant_id = w.tenant_id
    WHERE w.tenant_id = ?
      AND w.employee_id = ?
      AND w.week_start BETWEEN ? AND ?
  `).all(tenantId, employeeId, firstWeek, lastWeek) as Array<{
    week_start: string;
    approved_at: string;
    approved_by_name: string | null;
  }>;

  const totals = new Map<string, { total_hours: number; entry_count: number }>();
  for (const row of entryRows) {
    const key = weekStart(row.date);
    const current = totals.get(key) || { total_hours: 0, entry_count: 0 };
    current.total_hours = Number((current.total_hours + Number(row.hours || 0)).toFixed(2));
    current.entry_count += 1;
    totals.set(key, current);
  }

  const approvals = new Map<string, { approved_at: string; approved_by_name: string | null }>();
  for (const row of approvalRows) {
    approvals.set(row.week_start, {
      approved_at: row.approved_at,
      approved_by_name: row.approved_by_name,
    });
  }

  const weeks: CalendarWeekSummary[] = [];
  for (let i = 0; i < 16; i++) {
    const currentWeekStart = addDays(firstWeek, i * 7);
    const totalsRow = totals.get(currentWeekStart);
    const approval = approvals.get(currentWeekStart);

    weeks.push({
      week_start: currentWeekStart,
      week_end: addDays(currentWeekStart, 6),
      total_hours: Number((totalsRow?.total_hours || 0).toFixed(2)),
      entry_count: totalsRow?.entry_count || 0,
      approved_at: approval?.approved_at || null,
      approved_by_name: approval?.approved_by_name || null,
      is_selected: currentWeekStart === selectedStart,
      is_approved: !!approval,
    });
  }

  return weeks;
}

function assertWeekNotApproved(db: any, tenantId: number, employeeId: number, start: string, message?: string) {
  const approval = loadWeekApproval(db, tenantId, employeeId, start);
  if (approval) {
    throw new Error(message || 'This week has already been approved. Reopen the week before making changes.');
  }
}

function deriveSelectedEmployeeId(
  employees: EmployeeOption[],
  currentUser: any,
  linkedEmployeeId: number | null | undefined,
  requestedEmployeeId?: number | null,
): number | null {
  if (currentUser.role === 'Employee') {
    return linkedEmployeeId ?? null;
  }

  if (requestedEmployeeId && employees.some((employee) => employee.id === requestedEmployeeId)) {
    return requestedEmployeeId;
  }

  if (linkedEmployeeId && employees.some((employee) => employee.id === linkedEmployeeId)) {
    return linkedEmployeeId;
  }

  return employees.length > 0 ? employees[0].id : null;
}

function buildTimesheetState(
  db: any,
  tenantId: number,
  currentUser: any,
  options?: { employeeId?: number | null; start?: string },
): TimesheetViewState {
  const employees = loadEmployees(db, tenantId);
  const jobs = loadJobs(db, tenantId);
  const isEmployeeUser = currentUser.role === 'Employee';
  const canManageTimeEntries = userHasPermission(currentUser, 'time.approve');
  const canApproveEditRequests = userHasPermission(currentUser, 'time.approve');
  const canRequestEdits = userHasPermission(currentUser, 'time.edit_requests');
  const link = loadEmployeeForUser(db, currentUser.id, tenantId);
  const canUseSelfClock = userHasPermission(currentUser, 'time.clock') && !!(link?.employee_id && link?.employee_name);

  const fallbackStart = weekStart(toIsoDate(new Date()));
  const start = options?.start && isRealIsoDate(options.start) ? weekStart(options.start) : fallbackStart;
  const employeeId = deriveSelectedEmployeeId(employees, currentUser, link?.employee_id, options?.employeeId ?? null);
  const dates = weekDates(start);

  const currentEmployeeContext = canUseSelfClock && link?.employee_id && link?.employee_name
    ? { employeeId: link.employee_id, employeeName: link.employee_name }
    : null;

  const existing = loadExistingEntries(db, tenantId, employeeId, start);
  const pendingRequests = canApproveEditRequests ? loadPendingRequests(db, tenantId) : [];
  const activeClockEntry = canUseSelfClock ? loadActiveClockEntry(db, tenantId, link?.employee_id ?? null) : null;
  const weekApproval = loadWeekApproval(db, tenantId, employeeId, start);
  const weekCalendar = loadWeekCalendar(db, tenantId, employeeId, start);
  const pendingWeekEditRequestCount = countPendingWeekEditRequests(db, tenantId, employeeId, start);
  const openClockEntryCount = countOpenClockEntriesForWeek(db, tenantId, employeeId, start);
  const selectedWeekHours = Number(existing.reduce((sum, entry) => sum + Number(entry.hours || 0), 0).toFixed(2));
  const selectedWeekEntryCount = existing.length;

  return {
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
    weekApproval,
    weekCalendar,
    selectedWeekHours,
    selectedWeekEntryCount,
    pendingWeekEditRequestCount,
    openClockEntryCount,
    selectedWeekLabel: weekRangeLabel(start),
    prevWeekStart: addDays(start, -7),
    nextWeekStart: addDays(start, 7),
  };
}

function loadAdminWeeklyHours(db: any, tenantId: number, start: string): AdminHoursRow[] {
  const dates = weekDates(start);
  return db.prepare(`
    SELECT
      e.id AS employee_id,
      e.name AS employee_name,
      COALESCE(SUM(CASE WHEN t.date = ? THEN t.hours ELSE 0 END), 0) AS monday_hours,
      COALESCE(SUM(CASE WHEN t.date = ? THEN t.hours ELSE 0 END), 0) AS tuesday_hours,
      COALESCE(SUM(CASE WHEN t.date = ? THEN t.hours ELSE 0 END), 0) AS wednesday_hours,
      COALESCE(SUM(CASE WHEN t.date = ? THEN t.hours ELSE 0 END), 0) AS thursday_hours,
      COALESCE(SUM(CASE WHEN t.date = ? THEN t.hours ELSE 0 END), 0) AS friday_hours,
      COALESCE(SUM(CASE WHEN t.date = ? THEN t.hours ELSE 0 END), 0) AS saturday_hours,
      COALESCE(SUM(CASE WHEN t.date = ? THEN t.hours ELSE 0 END), 0) AS sunday_hours,
      COALESCE(SUM(t.hours), 0) AS total_hours,
      COUNT(t.id) AS entry_count,
      w.approved_at,
      u.name AS approved_by_name
    FROM employees e
    LEFT JOIN time_entries t
      ON t.employee_id = e.id
     AND t.tenant_id = e.tenant_id
     AND t.date BETWEEN ? AND ?
    LEFT JOIN time_entry_week_approvals w
      ON w.employee_id = e.id
     AND w.tenant_id = e.tenant_id
     AND w.week_start = ?
    LEFT JOIN users u
      ON u.id = w.approved_by_user_id
     AND u.tenant_id = w.tenant_id
    WHERE e.tenant_id = ?
      AND (
        e.active = 1
        OR EXISTS (
          SELECT 1
          FROM time_entries te
          WHERE te.employee_id = e.id
            AND te.tenant_id = e.tenant_id
            AND te.date BETWEEN ? AND ?
        )
      )
    GROUP BY e.id, e.name, w.approved_at, u.name
    ORDER BY e.name ASC
  `).all(
    dates[0],
    dates[1],
    dates[2],
    dates[3],
    dates[4],
    dates[5],
    dates[6],
    dates[0],
    dates[6],
    start,
    tenantId,
    dates[0],
    dates[6],
  ) as AdminHoursRow[];
}

function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function loadAdminWeeklyHourDetails(db: any, tenantId: number, start: string): AdminHoursDetailEntry[] {
  const dates = weekDates(start);

  return db.prepare(`
    SELECT
      e.id AS employee_id,
      e.name AS employee_name,
      t.date,
      COALESCE(j.job_name, 'Unassigned / General Time') AS job_name,
      t.hours,
      t.clock_in_at,
      t.clock_out_at,
      t.entry_method,
      t.note,
      COALESCE(e.lunch_deduction_exempt, 0) AS lunch_deduction_exempt
    FROM time_entries t
    JOIN employees e
      ON e.id = t.employee_id
     AND e.tenant_id = t.tenant_id
    LEFT JOIN jobs j
      ON j.id = t.job_id
     AND j.tenant_id = t.tenant_id
    WHERE t.tenant_id = ?
      AND t.date BETWEEN ? AND ?
    ORDER BY e.name ASC, t.date ASC, t.clock_in_at ASC, t.id ASC
  `).all(tenantId, dates[0], dates[6]) as AdminHoursDetailEntry[];
}

function buildAdminWeeklyHoursCsv(start: string, rows: AdminHoursRow[]): string {
  const header = [
    'Employee ID',
    'Employee Name',
    'Week Start',
    'Monday Hours',
    'Tuesday Hours',
    'Wednesday Hours',
    'Thursday Hours',
    'Friday Hours',
    'Saturday Hours',
    'Sunday Hours',
    'Total Hours',
    'Entry Count',
    'Approved',
    'Approved By',
  ];

  const lines = [header.join(',')];

  for (const row of rows) {
    lines.push([
      row.employee_id,
      row.employee_name,
      start,
      Number(row.monday_hours || 0).toFixed(2),
      Number(row.tuesday_hours || 0).toFixed(2),
      Number(row.wednesday_hours || 0).toFixed(2),
      Number(row.thursday_hours || 0).toFixed(2),
      Number(row.friday_hours || 0).toFixed(2),
      Number(row.saturday_hours || 0).toFixed(2),
      Number(row.sunday_hours || 0).toFixed(2),
      Number(row.total_hours || 0).toFixed(2),
      row.entry_count,
      row.approved_at ? 'Yes' : 'No',
      row.approved_by_name || '',
    ].map(csvCell).join(','));
  }

  return lines.join('\n');
}

function renderTimesheetPage(
  c: any,
  state: TimesheetViewState,
  extras?: { error?: string; success?: string },
  status: 200 | 400 = 200,
) {
  const currentUser = c.get('user');

  return renderApp(
    c,
    state.isEmployeeUser ? 'Time Clock' : 'Weekly Timesheet',
    <TimesheetPage
      employees={state.employees}
      jobs={state.jobs}
      employeeId={state.employeeId}
      start={state.start}
      dates={state.dates}
      existing={state.existing}
      pendingRequests={state.pendingRequests}
      currentEmployeeContext={state.currentEmployeeContext}
      activeClockEntry={state.activeClockEntry}
      isEmployeeUser={state.isEmployeeUser}
      canUseSelfClock={state.canUseSelfClock}
      canRequestEdits={state.canRequestEdits}
      canManageTimeEntries={state.canManageTimeEntries}
      canApproveEditRequests={state.canApproveEditRequests}
      csrfToken={c.get('csrfToken')}
      weekApproval={state.weekApproval}
      weekCalendar={state.weekCalendar}
      selectedWeekHours={state.selectedWeekHours}
      selectedWeekEntryCount={state.selectedWeekEntryCount}
      pendingWeekEditRequestCount={state.pendingWeekEditRequestCount}
      openClockEntryCount={state.openClockEntryCount}
      selectedWeekLabel={state.selectedWeekLabel}
      prevWeekStart={state.prevWeekStart}
      nextWeekStart={state.nextWeekStart}
      error={extras?.error}
      success={extras?.success}
      showAdminHoursLink={currentUser?.role === 'Admin'}
    />,
    status,
  );
}

export const timesheetRoutes = new Hono<AppEnv>();

timesheetRoutes.get('/timesheet', permissionRequired('time.view'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const requestedEmployeeId = parsePositiveInt(c.req.query('employee_id'));
  const requestedStart = c.req.query('start') || undefined;
  const state = buildTimesheetState(db, tenant.id, currentUser, {
    employeeId: requestedEmployeeId,
    start: requestedStart,
  });

  if (state.isEmployeeUser && !state.employeeId) {
    return renderTimesheetPage(c, {
      ...state,
      existing: [],
      weekCalendar: [],
      weekApproval: null,
      pendingWeekEditRequestCount: 0,
      openClockEntryCount: 0,
      selectedWeekHours: 0,
      selectedWeekEntryCount: 0,
    }, {
      error: 'Your user account is not linked to an employee record yet. Ask an Admin to link your user to an employee profile.',
    }, 400);
  }

  return renderTimesheetPage(c, state);
});

timesheetRoutes.get('/timesheet/admin-hours', roleRequired('Admin'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const rawStart = c.req.query('start') || toIsoDate(new Date());
  const start = isRealIsoDate(rawStart) ? weekStart(rawStart) : weekStart(toIsoDate(new Date()));
  const rows = loadAdminWeeklyHours(getDb(), tenant.id, start);
  const totalHours = Number(rows.reduce((sum, row) => sum + Number(row.total_hours || 0), 0).toFixed(2));
  const approvedCount = rows.filter((row) => !!row.approved_at).length;

  return renderApp(
    c,
    'Weekly Employee Hours',
    <AdminWeeklyHoursPage
      start={start}
      end={addDays(start, 6)}
      prevWeekStart={addDays(start, -7)}
      nextWeekStart={addDays(start, 7)}
      rows={rows}
      totalHours={totalHours}
      approvedCount={approvedCount}
      employeeCount={rows.length}
    />,
  );
});

timesheetRoutes.get('/timesheet/admin-hours/export.csv', roleRequired('Admin'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const rawStart = c.req.query('start') || toIsoDate(new Date());
  const start = isRealIsoDate(rawStart) ? weekStart(rawStart) : weekStart(toIsoDate(new Date()));
  const rows = loadAdminWeeklyHours(getDb(), tenant.id, start);
  const csv = buildAdminWeeklyHoursCsv(start, rows);

  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="weekly_employee_hours_${start}.csv"`);
  c.header('Cache-Control', 'no-store');

  return c.body(csv);
});

timesheetRoutes.get('/timesheet/admin-hours/export.pdf', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const rawStart = c.req.query('start') || toIsoDate(new Date());
  const start = isRealIsoDate(rawStart) ? weekStart(rawStart) : weekStart(toIsoDate(new Date()));
  const db = getDb();
  const rows = loadAdminWeeklyHours(db, tenant.id, start);
  const detailEntries = loadAdminWeeklyHourDetails(db, tenant.id, start);
  const end = addDays(start, 6);

  const pdfBytes = await generateWeeklyHoursPdf({
    tenant: {
      name: tenant.name,
      logo_path: tenant.logo_path ?? null,
    },
    week: {
      start,
      end,
    },
    summaries: rows,
    detailEntries,
  });

  const safeTenantName = String(tenant.name || 'tenant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'tenant';

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeTenantName}_weekly_employee_hours_${start}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
});

timesheetRoutes.post('/timesheet', permissionRequired('time.approve'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const body = await c.req.parseBody({ all: true }) as Record<string, unknown>;

  let employeeId: number | null = null;
  let start = weekStart(toIsoDate(new Date()));

  try {
    employeeId = normalizeEmployeeId(body.employee_id);
    start = normalizeWeekStart(body.start);

    assertWeekNotApproved(db, tenant.id, employeeId, start);

    const { rate, lunchDeductionExempt } = getEmployeeCompensationSettings(db, employeeId, tenant.id);
    const allowedDates = new Set(weekDates(start));
    const rowDates = bodyValues(body, 'row_date');
    const rowTimeIns = bodyValues(body, 'row_time_in_local');
    const rowTimeOuts = bodyValues(body, 'row_time_out_local');
    const rowJobIds = bodyValues(body, 'row_job_id');
    const rowNotes = bodyValues(body, 'row_note');

    let insertedCount = 0;

    for (let i = 0; i < rowDates.length; i++) {
      const rawDate = String(rowDates[i] ?? '').trim();
      const rawTimeIn = parseLocalTime(rowTimeIns[i]);
      const rawTimeOut = parseLocalTime(rowTimeOuts[i]);
      const rawJobId = String(rowJobIds[i] ?? '').trim();
      const rawNote = rowNotes[i];
      const hasAnyValue = !!(rawTimeIn || rawTimeOut || rawJobId || String(rawNote ?? '').trim());

      if (!hasAnyValue) {
        continue;
      }

      if (!isRealIsoDate(rawDate) || !allowedDates.has(rawDate)) {
        throw new Error('One or more entry dates are invalid for the selected week.');
      }

      if (!rawTimeIn || !rawTimeOut) {
        throw new Error('Each manual entry row must include both time in and time out.');
      }

      const clockInUtc = localDateTimeToUtc(rawDate, rawTimeIn);
      const clockOutUtc = localDateTimeToUtc(rawDate, rawTimeOut);
      const rawHours = hoursBetween(clockInUtc, clockOutUtc);
      const hours = applyAutomaticLunchDeduction(rawHours, lunchDeductionExempt);
      const note = normalizeNote(rawNote);
      const jobId = rawJobId ? parsePositiveInt(rawJobId) : null;

      if (rawJobId && !jobId) {
        throw new Error('Please select a valid job when a job is provided.');
      }

      if (jobId) {
        ensureJobExists(db, jobId, tenant.id);
      }

      const laborCost = Number((hours * rate).toFixed(2));

      db.prepare(`
        INSERT INTO time_entries (
          job_id, employee_id, date, hours, note, labor_cost, tenant_id,
          clock_in_at, clock_out_at, entry_method, approval_status, approved_by_user_id, approved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'approved', ?, CURRENT_TIMESTAMP)
      `).run(jobId, employeeId, rawDate, hours, note, laborCost, tenant.id, clockInUtc, clockOutUtc, currentUser.id);

      insertedCount += 1;
    }

    const state = buildTimesheetState(db, tenant.id, currentUser, { employeeId, start });
    return renderTimesheetPage(c, state, {
      success: insertedCount > 0 ? 'Time entries saved successfully.' : 'No new time entries were added.',
    });
  } catch (error) {
    const state = buildTimesheetState(db, tenant.id, currentUser, { employeeId, start });
    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to save time entries.',
    }, 400);
  }
});

timesheetRoutes.post('/timesheet/week-approve', permissionRequired('time.approve'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const body = await c.req.parseBody({ all: true }) as Record<string, unknown>;

  let employeeId: number | null = null;
  let start = weekStart(toIsoDate(new Date()));

  try {
    employeeId = normalizeEmployeeId(body.employee_id);
    start = normalizeWeekStart(body.start);
    const note = normalizeNote(body.note);

    const existing = loadExistingEntries(db, tenant.id, employeeId, start);
    if (existing.length === 0) {
      throw new Error('Add at least one completed time entry before approving the week.');
    }

    if (existing.some((entry) => !entry.clock_out_at)) {
      throw new Error('An open clock entry must be closed before this week can be approved.');
    }

    if (existing.some((entry) => entry.approval_status !== 'approved')) {
      throw new Error('Resolve all pending edit requests before approving the week.');
    }

    if (countPendingWeekEditRequests(db, tenant.id, employeeId, start) > 0) {
      throw new Error('Resolve all pending edit requests before approving the week.');
    }

    db.prepare(`
      INSERT INTO time_entry_week_approvals (
        tenant_id, employee_id, week_start, approved_by_user_id, approved_at, note
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(tenant_id, employee_id, week_start)
      DO UPDATE SET
        approved_by_user_id = excluded.approved_by_user_id,
        approved_at = CURRENT_TIMESTAMP,
        note = excluded.note
    `).run(tenant.id, employeeId, start, currentUser.id, note);

    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: currentUser.id,
      eventType: 'time.week_approved',
      entityType: 'employee',
      entityId: employeeId,
      description: `${currentUser.name} approved the timesheet week starting ${start} for employee #${employeeId}.`,
      metadata: {
        employee_id: employeeId,
        week_start: start,
        week_end: addDays(start, 6),
        note,
      },
      ipAddress: resolveRequestIp(c),
    });

    const state = buildTimesheetState(db, tenant.id, currentUser, { employeeId, start });
    return renderTimesheetPage(c, state, {
      success: 'Week approved. Employee edits are now locked until the week is reopened.',
    });
  } catch (error) {
    const state = buildTimesheetState(db, tenant.id, currentUser, { employeeId, start });
    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to approve the week.',
    }, 400);
  }
});

timesheetRoutes.post('/timesheet/week-reopen', permissionRequired('time.approve'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const body = await c.req.parseBody({ all: true }) as Record<string, unknown>;

  let employeeId: number | null = null;
  let start = weekStart(toIsoDate(new Date()));

  try {
    employeeId = normalizeEmployeeId(body.employee_id);
    start = normalizeWeekStart(body.start);

    const approval = loadWeekApproval(db, tenant.id, employeeId, start);
    if (!approval) {
      throw new Error('This week is not currently approved.');
    }

    db.prepare(`
      DELETE FROM time_entry_week_approvals
      WHERE tenant_id = ? AND employee_id = ? AND week_start = ?
    `).run(tenant.id, employeeId, start);

    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: currentUser.id,
      eventType: 'time.week_reopened',
      entityType: 'employee',
      entityId: employeeId,
      description: `${currentUser.name} reopened the timesheet week starting ${start} for employee #${employeeId}.`,
      metadata: {
        employee_id: employeeId,
        week_start: start,
        week_end: addDays(start, 6),
      },
      ipAddress: resolveRequestIp(c),
    });

    const state = buildTimesheetState(db, tenant.id, currentUser, { employeeId, start });
    return renderTimesheetPage(c, state, {
      success: 'Week reopened. Time entries can be adjusted again.',
    });
  } catch (error) {
    const state = buildTimesheetState(db, tenant.id, currentUser, { employeeId, start });
    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to reopen the week.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/punch-in', permissionRequired('time.clock'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const link = loadEmployeeForUser(db, currentUser.id, tenant.id);

  try {
    const employeeId = link?.employee_id ?? null;
    if (!employeeId) {
      throw new Error('Your user account is not linked to an employee record.');
    }

    const todayStart = weekStart(toIsoDate(new Date()));
    assertWeekNotApproved(db, tenant.id, employeeId, todayStart, 'Your timesheet for this week has already been approved. Ask a manager to reopen the week before clocking in.');

    const activeClockEntry = loadActiveClockEntry(db, tenant.id, employeeId);
    if (activeClockEntry) {
      throw new Error('You are already clocked in.');
    }

    const body = await c.req.parseBody({ all: true }) as Record<string, unknown>;
    const nowUtc = resolveClientNowUtc(body.client_now_utc);
    const note = normalizeNote(body.note);

    // 🆕 NEW: Optional job selection
    const rawJobId = String(body.job_id ?? '').trim();
    let jobId: number | null = null;

    if (rawJobId) {
      const parsed = parsePositiveInt(rawJobId);
      if (!parsed) {
        throw new Error('Invalid job selected.');
      }

      ensureJobExists(db, parsed, tenant.id);
      jobId = parsed;
    }

    db.prepare(`
      INSERT INTO time_entries (
        job_id, employee_id, date, hours, note, labor_cost, tenant_id,
        clock_in_at, clock_out_at, entry_method, approval_status, approved_by_user_id, approved_at
      )
      VALUES (?, ?, ?, 0, ?, 0, ?, ?, NULL, 'clock', 'approved', ?, CURRENT_TIMESTAMP)
    `).run(
      jobId, // 🆕 NOW STORES JOB OR NULL
      employeeId,
      toIsoDate(new Date(nowUtc)),
      note,
      tenant.id,
      nowUtc,
      currentUser.id
    );

    const state = buildTimesheetState(db, tenant.id, currentUser);
    return renderTimesheetPage(c, state, {
      success: 'You are now clocked in.',
    });
  } catch (error) {
    const state = buildTimesheetState(db, tenant.id, currentUser);
    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to punch in.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/punch-out', permissionRequired('time.clock'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const link = loadEmployeeForUser(db, currentUser.id, tenant.id);

  try {
    const employeeId = link?.employee_id ?? null;
    if (!employeeId) {
      throw new Error('Your user account is not linked to an employee record.');
    }

    const activeClockEntry = loadActiveClockEntry(db, tenant.id, employeeId);
    if (!activeClockEntry) {
      throw new Error('You are not currently clocked in.');
    }

    const body = await c.req.parseBody({ all: true }) as Record<string, unknown>;
    const nowUtc = resolveClientNowUtc(body.client_now_utc);

    let rawHours: number;
    try {
      rawHours = hoursBetween(activeClockEntry.clock_in_at, nowUtc);
    } catch (error) {
      if (error instanceof Error && error.message === 'A single entry cannot exceed 24 hours.') {
        throw new Error('This open clock entry is now older than 24 hours. Use Resolve Open Entry and enter the actual clock-out time from yesterday.');
      }
      throw error;
    }

    const { rate, lunchDeductionExempt } = getEmployeeCompensationSettings(db, employeeId, tenant.id);
    const deductedHours = applyAutomaticLunchDeduction(rawHours, lunchDeductionExempt);
    const laborCost = Number((deductedHours * rate).toFixed(2));

    db.prepare(`
      UPDATE time_entries
      SET clock_out_at = ?,
          hours = ?,
          labor_cost = ?,
          approved_by_user_id = ?,
          approved_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).run(nowUtc, deductedHours, laborCost, currentUser.id, activeClockEntry.id, tenant.id);

    const state = buildTimesheetState(db, tenant.id, currentUser);
    return renderTimesheetPage(c, state, {
      success: 'You have been clocked out successfully.',
    });
  } catch (error) {
    const state = buildTimesheetState(db, tenant.id, currentUser);
    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to punch out.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/resolve-open/:id', permissionRequired('time.view'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const entryId = parsePositiveInt(c.req.param('id'));
  if (!entryId) {
    return c.text('Time entry not found', 404);
  }

  const db = getDb();
  const body = await c.req.parseBody({ all: true }) as Record<string, unknown>;
  const link = loadEmployeeForUser(db, currentUser.id, tenant.id);

  let fallbackEmployeeId = link?.employee_id ?? null;
  let fallbackStart = weekStart(toIsoDate(new Date()));

  try {
    const entry = db.prepare(`
      SELECT id, employee_id, date, clock_in_at, clock_out_at, note
      FROM time_entries
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `).get(entryId, tenant.id) as
      | {
          id: number;
          employee_id: number;
          date: string;
          clock_in_at: string | null;
          clock_out_at: string | null;
          note: string | null;
        }
      | undefined;

    if (!entry || !entry.clock_in_at) {
      throw new Error('Open time entry not found.');
    }

    fallbackEmployeeId = entry.employee_id;
    fallbackStart = weekStart(entry.date);

    if (entry.clock_out_at) {
      throw new Error('This time entry is already closed.');
    }

    const canManageAnyEntry = userHasPermission(currentUser, 'time.approve');
    if (!canManageAnyEntry && link?.employee_id !== entry.employee_id) {
      throw new Error('You can only resolve your own open clock entries.');
    }

    assertWeekNotApproved(
      db,
      tenant.id,
      entry.employee_id,
      weekStart(entry.date),
      'This week has already been approved. Reopen the week before resolving this open clock entry.'
    );

    const clockOutUtc = String(body.clock_out_utc ?? '').trim();
    if (!isValidIsoDateTime(clockOutUtc)) {
      throw new Error('Please provide a valid clock-out time.');
    }

    const rawHours = hoursBetween(entry.clock_in_at, clockOutUtc);
    const { rate, lunchDeductionExempt } = getEmployeeCompensationSettings(db, entry.employee_id, tenant.id);
    const hours = applyAutomaticLunchDeduction(rawHours, lunchDeductionExempt);
    const laborCost = Number((hours * rate).toFixed(2));
    const note = normalizeNote(body.note) ?? entry.note;

    db.prepare(`
      UPDATE time_entries
      SET clock_out_at = ?,
          hours = ?,
          labor_cost = ?,
          note = ?,
          approval_status = 'approved',
          approved_by_user_id = ?,
          approved_at = CURRENT_TIMESTAMP,
          last_edited_by_user_id = ?,
          last_edited_at = CURRENT_TIMESTAMP,
          edit_reason = 'Resolved previously open clock entry'
      WHERE id = ? AND tenant_id = ?
    `).run(
      clockOutUtc,
      hours,
      laborCost,
      note,
      currentUser.id,
      currentUser.id,
      entry.id,
      tenant.id,
    );

    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: currentUser.id,
      eventType: 'time.open_entry_resolved',
      entityType: 'time_entry',
      entityId: entry.id,
      description: `${currentUser.name} resolved an open clock entry for employee #${entry.employee_id}.`,
      metadata: {
        time_entry_id: entry.id,
        employee_id: entry.employee_id,
        clock_in_at: entry.clock_in_at,
        clock_out_at: clockOutUtc,
        hours,
      },
      ipAddress: resolveRequestIp(c),
    });

    const state = buildTimesheetState(db, tenant.id, currentUser, {
      employeeId: fallbackEmployeeId,
      start: fallbackStart,
    });

    return renderTimesheetPage(c, state, {
      success: 'Open clock entry resolved successfully.',
    });
  } catch (error) {
    const state = buildTimesheetState(db, tenant.id, currentUser, {
      employeeId: fallbackEmployeeId,
      start: fallbackStart,
    });

    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to resolve the open clock entry.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/request-edit/:id', permissionRequired('time.edit_requests'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const timeEntryId = parsePositiveInt(c.req.param('id'));
  if (!timeEntryId) {
    return c.text('Time entry not found', 404);
  }

  const db = getDb();
  const link = loadEmployeeForUser(db, currentUser.id, tenant.id);

  try {
    const employeeId = link?.employee_id ?? null;
    if (!employeeId) {
      throw new Error('Your user account is not linked to an employee record.');
    }

    const timeEntry = db.prepare(`
      SELECT id, employee_id, job_id, date, clock_in_at, clock_out_at, note
      FROM time_entries
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
    `).get(timeEntryId, tenant.id) as
      | {
          id: number;
          employee_id: number;
          job_id: number | null;
          date: string;
          clock_in_at: string | null;
          clock_out_at: string | null;
          note: string | null;
        }
      | undefined;

    if (!timeEntry || timeEntry.employee_id !== employeeId) {
      throw new Error('You can only request edits for your own time entries.');
    }

    assertWeekNotApproved(db, tenant.id, employeeId, weekStart(timeEntry.date), 'This week has already been approved, so employee edit requests are locked. Ask a manager to reopen the week first.');

    const existingPending = db.prepare(`
      SELECT id
      FROM time_entry_edit_requests
      WHERE time_entry_id = ? AND tenant_id = ? AND status = 'pending'
      LIMIT 1
    `).get(timeEntryId, tenant.id) as { id: number } | undefined;

    if (existingPending) {
      throw new Error('An edit request is already pending for this entry.');
    }

    const body = await c.req.parseBody({ all: true }) as Record<string, unknown>;
    const proposedClockIn = String(body.clock_in_utc ?? '').trim();
    const proposedClockOut = String(body.clock_out_utc ?? '').trim();
    const requestReason = String(body.request_reason ?? '').trim();
    const proposedNote = normalizeNote(body.note);

    if (!isValidIsoDateTime(proposedClockIn) || !isValidIsoDateTime(proposedClockOut)) {
      throw new Error('Please provide valid clock in and clock out values.');
    }

    if (!requestReason) {
      throw new Error('Please explain why this edit is being requested.');
    }

    if (requestReason.length > 500) {
      throw new Error('Request reason must be 500 characters or less.');
    }

    const proposedDate = toIsoDate(new Date(proposedClockIn));
    const proposedHours = hoursBetween(proposedClockIn, proposedClockOut);

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
        request_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenant.id,
      timeEntryId,
      employeeId,
      currentUser.id,
      timeEntry.job_id,
      proposedDate,
      proposedClockIn,
      proposedClockOut,
      proposedHours,
      proposedNote,
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
        time_entry_id: timeEntryId,
        proposed_clock_in_at: proposedClockIn,
        proposed_clock_out_at: proposedClockOut,
        proposed_hours: proposedHours,
      },
      ipAddress: resolveRequestIp(c),
    });

    const state = buildTimesheetState(db, tenant.id, currentUser);
    return renderTimesheetPage(c, state, {
      success: 'Your edit request has been submitted for approval.',
    });
  } catch (error) {
    const state = buildTimesheetState(db, tenant.id, currentUser);
    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to submit edit request.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/edit-request/:id/approve', permissionRequired('time.approve'), async (c) => {
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

  try {
    assertWeekNotApproved(db, tenant.id, request.employee_id, weekStart(request.proposed_date));

    const { rate, lunchDeductionExempt } = getEmployeeCompensationSettings(db, request.employee_id, tenant.id);
    const approvedHours = applyAutomaticLunchDeduction(Number(request.proposed_hours || 0), lunchDeductionExempt);
    const laborCost = Number((approvedHours * rate).toFixed(2));

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
      approvedHours,
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
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect('/timesheet');
  } catch (error) {
    const state = buildTimesheetState(db, tenant.id, currentUser);
    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to approve the edit request.',
    }, 400);
  }
});

timesheetRoutes.post('/timeclock/edit-request/:id/reject', permissionRequired('time.approve'), async (c) => {
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

timesheetRoutes.post('/delete_time/:id', permissionRequired('time.approve'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;

  const timeId = parsePositiveInt(c.req.param('id'));
  if (!timeId) {
    return c.text('Time entry not found', 404);
  }

  const db = getDb();

  const entry = db.prepare(`
    SELECT id, employee_id, date
    FROM time_entries
    WHERE id = ? AND tenant_id = ?
  `).get(timeId, tenantId) as { id: number; employee_id: number; date: string } | undefined;

  if (!entry) {
    return c.text('Time entry not found', 404);
  }

  try {
    assertWeekNotApproved(db, tenantId, entry.employee_id, weekStart(entry.date));

    db.prepare('DELETE FROM time_entry_edit_requests WHERE time_entry_id = ? AND tenant_id = ?').run(timeId, tenantId);
    db.prepare('DELETE FROM time_entries WHERE id = ? AND tenant_id = ?').run(timeId, tenantId);

    const referer = c.req.header('Referer') || '/timesheet';
    return c.redirect(referer);
  } catch (error) {
    const currentUser = c.get('user');
    if (!currentUser) return c.redirect('/login');
    const state = buildTimesheetState(db, tenantId, currentUser, { employeeId: entry.employee_id, start: weekStart(entry.date) });
    return renderTimesheetPage(c, state, {
      error: error instanceof Error ? error.message : 'Unable to delete the time entry.',
    }, 400);
  }
});

export default timesheetRoutes;
