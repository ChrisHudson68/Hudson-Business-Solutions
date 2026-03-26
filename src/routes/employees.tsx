import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { permissionRequired, userHasPermission } from '../middleware/auth.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { EmployeesPage } from '../pages/employees/EmployeesPage.js';
import { AddEmployeePage } from '../pages/employees/AddEmployeePage.js';
import { EditEmployeePage } from '../pages/employees/EditEmployeePage.js';
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

const ALLOWED_PAY_TYPES = ['Hourly', 'Salary'] as const;
type PayType = (typeof ALLOWED_PAY_TYPES)[number];

function parsePositiveInt(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function requireName(value: unknown): string {
  const parsed = String(value ?? '').trim();

  if (!parsed) {
    throw new Error('Employee name is required.');
  }

  if (parsed.length > 120) {
    throw new Error('Employee name must be 120 characters or less.');
  }

  return parsed;
}

function parsePayType(value: unknown): PayType {
  const parsed = String(value ?? 'Hourly').trim() as PayType;

  if (!ALLOWED_PAY_TYPES.includes(parsed)) {
    throw new Error('Please select a valid pay type.');
  }

  return parsed;
}

function parseNonNegativeMoney(value: unknown, fieldLabel: string): number {
  const raw = String(value ?? '').trim();

  if (!raw) return 0;

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldLabel} must be a valid non-negative number with up to 2 decimal places.`);
  }

  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a valid non-negative number.`);
  }

  return Number(parsed.toFixed(2));
}

function parseCheckboxFlag(value: unknown): number {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes' ? 1 : 0;
}

function normalizeEmployeeInput(body: Record<string, unknown>) {
  const payType = parsePayType(body.pay_type);
  const hourlyRate = parseNonNegativeMoney(body.hourly_rate, 'Hourly rate');
  const annualSalary = parseNonNegativeMoney(body.annual_salary, 'Annual salary');
  const lunchDeductionExempt = parseCheckboxFlag(body.lunch_deduction_exempt);

  if (payType === 'Hourly' && hourlyRate <= 0) {
    throw new Error('Hourly employees must have an hourly rate greater than 0.');
  }

  if (payType === 'Salary' && annualSalary <= 0) {
    throw new Error('Salaried employees must have an annual salary greater than 0.');
  }

  return {
    name: requireName(body.name),
    pay_type: payType,
    hourly_rate: payType === 'Hourly' ? hourlyRate : 0,
    annual_salary: payType === 'Salary' ? annualSalary : 0,
    lunch_deduction_exempt: lunchDeductionExempt,
  };
}

function buildEmployeeFormData(source: Record<string, unknown>) {
  return {
    name: String(source.name ?? ''),
    pay_type: String(source.pay_type ?? 'Hourly'),
    hourly_rate: String(source.hourly_rate ?? '0'),
    annual_salary: String(source.annual_salary ?? '0'),
    active: String(source.active ?? '1'),
    lunch_deduction_exempt: parseCheckboxFlag(source.lunch_deduction_exempt),
  };
}

function getEmployeeById(db: any, employeeId: number, tenantId: number) {
  return db.prepare(`
    SELECT id, name, pay_type, hourly_rate, annual_salary, active, archived_at, archived_by_user_id,
           COALESCE(lunch_deduction_exempt, 0) AS lunch_deduction_exempt
    FROM employees
    WHERE id = ? AND tenant_id = ?
  `).get(employeeId, tenantId) as
    | {
        id: number;
        name: string;
        pay_type: string;
        hourly_rate: number | null;
        annual_salary: number | null;
        active: number;
        archived_at: string | null;
        archived_by_user_id: number | null;
        lunch_deduction_exempt: number;
      }
    | undefined;
}

export const employeeRoutes = new Hono<AppEnv>();

employeeRoutes.get('/employees', permissionRequired('employees.view'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;
  const showArchived = c.req.query('show_archived') === '1';

  const db = getDb();
  const employees = db.prepare(`
    SELECT id, name, pay_type, hourly_rate, annual_salary, active, archived_at,
           COALESCE(lunch_deduction_exempt, 0) AS lunch_deduction_exempt
    FROM employees
    WHERE tenant_id = ?
      ${showArchived ? 'AND archived_at IS NOT NULL' : 'AND archived_at IS NULL'}
    ORDER BY
      CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END,
      active DESC,
      name ASC
  `).all(tenantId) as Array<{
    id: number;
    name: string;
    pay_type: string;
    hourly_rate: number | null;
    annual_salary: number | null;
    active: number;
    archived_at: string | null;
    lunch_deduction_exempt: number;
  }>;

  return renderApp(
    c,
    'Employees',
    <EmployeesPage
      employees={employees}
      csrfToken={c.get('csrfToken')}
      showArchived={showArchived}
      canCreateEmployees={userHasPermission(c.get('user'), 'employees.create')}
      canEditEmployees={userHasPermission(c.get('user'), 'employees.edit')}
      canArchiveEmployees={userHasPermission(c.get('user'), 'employees.archive')}
    />
  );
});

employeeRoutes.get('/add_employee', permissionRequired('employees.create'), (c) => {
  return renderApp(
    c,
    'Add Employee',
    <AddEmployeePage
      formData={{
        name: '',
        pay_type: 'Hourly',
        hourly_rate: '0',
        annual_salary: '0',
        lunch_deduction_exempt: 0,
      }}
      csrfToken={c.get('csrfToken')}
    />
  );
});

employeeRoutes.post('/add_employee', permissionRequired('employees.create'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');
  const tenantId = tenant.id;

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildEmployeeFormData(body);

  try {
    const normalized = normalizeEmployeeInput(body);

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO employees (
        name, pay_type, hourly_rate, annual_salary, active, tenant_id, archived_at, archived_by_user_id, lunch_deduction_exempt
      )
      VALUES (?, ?, ?, ?, 1, ?, NULL, NULL, ?)
    `).run(
      normalized.name,
      normalized.pay_type,
      normalized.hourly_rate,
      normalized.annual_salary,
      tenantId,
      normalized.lunch_deduction_exempt,
    );

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'employee.created',
      entityType: 'employee',
      entityId: Number(result.lastInsertRowid),
      description: `${currentUser.name} created employee ${normalized.name}.`,
      metadata: {
        name: normalized.name,
        pay_type: normalized.pay_type,
        hourly_rate: normalized.hourly_rate,
        annual_salary: normalized.annual_salary,
        active: 1,
        lunch_deduction_exempt: normalized.lunch_deduction_exempt,
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect('/employees');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add employee.';
    return renderApp(
      c,
      'Add Employee',
      <AddEmployeePage
        formData={formData}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

employeeRoutes.get('/edit_employee/:id', permissionRequired('employees.edit'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;
  const employeeId = parsePositiveInt(c.req.param('id'));

  if (!employeeId) {
    return c.text('Employee not found', 404);
  }

  const db = getDb();
  const emp = getEmployeeById(db, employeeId, tenantId);

  if (!emp) {
    return c.text('Employee not found', 404);
  }

  return renderApp(
    c,
    'Edit Employee',
    <EditEmployeePage
      employee={emp}
      csrfToken={c.get('csrfToken')}
      canArchiveEmployees={userHasPermission(c.get('user'), 'employees.archive')}
    />
  );
});

employeeRoutes.post('/edit_employee/:id', permissionRequired('employees.edit'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');
  const tenantId = tenant.id;
  const employeeId = parsePositiveInt(c.req.param('id'));

  if (!employeeId) {
    return c.text('Employee not found', 404);
  }

  const db = getDb();
  const existingEmployee = getEmployeeById(db, employeeId, tenantId);

  if (!existingEmployee) {
    return c.text('Employee not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildEmployeeFormData(body);

  try {
    const normalized = normalizeEmployeeInput(body);
    const active = String(body.active ?? '1') === '1' ? 1 : 0;

    const before = {
      name: existingEmployee.name,
      pay_type: existingEmployee.pay_type,
      hourly_rate: Number(existingEmployee.hourly_rate || 0),
      annual_salary: Number(existingEmployee.annual_salary || 0),
      active: Number(existingEmployee.active || 0),
      lunch_deduction_exempt: Number(existingEmployee.lunch_deduction_exempt || 0),
    };

    db.prepare(`
      UPDATE employees
      SET name = ?, pay_type = ?, hourly_rate = ?, annual_salary = ?, active = ?, lunch_deduction_exempt = ?
      WHERE id = ? AND tenant_id = ?
    `).run(
      normalized.name,
      normalized.pay_type,
      normalized.hourly_rate,
      normalized.annual_salary,
      active,
      normalized.lunch_deduction_exempt,
      employeeId,
      tenantId,
    );

    const after = {
      name: normalized.name,
      pay_type: normalized.pay_type,
      hourly_rate: normalized.hourly_rate,
      annual_salary: normalized.annual_salary,
      active,
      lunch_deduction_exempt: normalized.lunch_deduction_exempt,
    };

    logActivity(db, {
      tenantId,
      actorUserId: currentUser.id,
      eventType: 'employee.updated',
      entityType: 'employee',
      entityId: employeeId,
      description: `${currentUser.name} updated employee ${normalized.name}.`,
      metadata: { before, after },
      ipAddress: resolveRequestIp(c),
    });

    if (before.active !== after.active) {
      logActivity(db, {
        tenantId,
        actorUserId: currentUser.id,
        eventType: active === 1 ? 'employee.reactivated' : 'employee.deactivated',
        entityType: 'employee',
        entityId: employeeId,
        description: `${currentUser.name} ${active === 1 ? 'reactivated' : 'deactivated'} employee ${normalized.name}.`,
        metadata: { before_active: before.active, after_active: active },
        ipAddress: resolveRequestIp(c),
      });
    }

    const updatedEmployee = getEmployeeById(db, employeeId, tenantId);
    if (!updatedEmployee) {
      return c.text('Employee not found', 404);
    }

    return renderApp(
      c,
      'Edit Employee',
      <EditEmployeePage
        employee={updatedEmployee}
        success="Employee updated successfully."
        csrfToken={c.get('csrfToken')}
        canArchiveEmployees={userHasPermission(c.get('user'), 'employees.archive')}
      />
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update employee.';

    return renderApp(
      c,
      'Edit Employee',
      <EditEmployeePage
        employee={{
          ...existingEmployee,
          ...formData,
          active: String(formData.active) === '1' ? 1 : 0,
          hourly_rate: Number(formData.hourly_rate || 0),
          annual_salary: Number(formData.annual_salary || 0),
          lunch_deduction_exempt: Number(formData.lunch_deduction_exempt || 0),
        }}
        error={message}
        csrfToken={c.get('csrfToken')}
        canArchiveEmployees={userHasPermission(c.get('user'), 'employees.archive')}
      />,
      400,
    );
  }
});

employeeRoutes.post('/archive_employee/:id', permissionRequired('employees.archive'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');
  const tenantId = tenant.id;
  const employeeId = parsePositiveInt(c.req.param('id'));

  if (!employeeId) {
    return c.text('Employee not found', 404);
  }

  const db = getDb();
  const employee = getEmployeeById(db, employeeId, tenantId);

  if (!employee) {
    return c.text('Employee not found', 404);
  }

  if (employee.archived_at) {
    return c.redirect('/employees?show_archived=1');
  }

  db.prepare(`
    UPDATE employees
    SET archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = ?,
        active = 0
    WHERE id = ? AND tenant_id = ? AND archived_at IS NULL
  `).run(currentUser.id, employeeId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'employee.archived',
    entityType: 'employee',
    entityId: employeeId,
    description: `${currentUser.name} archived employee ${employee.name}.`,
    metadata: {
      name: employee.name,
      pay_type: employee.pay_type,
      hourly_rate: Number(employee.hourly_rate || 0),
      annual_salary: Number(employee.annual_salary || 0),
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/employees');
});

employeeRoutes.post('/restore_employee/:id', permissionRequired('employees.archive'), (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');
  const tenantId = tenant.id;
  const employeeId = parsePositiveInt(c.req.param('id'));

  if (!employeeId) {
    return c.text('Employee not found', 404);
  }

  const db = getDb();
  const employee = getEmployeeById(db, employeeId, tenantId);

  if (!employee) {
    return c.text('Employee not found', 404);
  }

  db.prepare(`
    UPDATE employees
    SET archived_at = NULL,
        archived_by_user_id = NULL
    WHERE id = ? AND tenant_id = ?
  `).run(employeeId, tenantId);

  logActivity(db, {
    tenantId,
    actorUserId: currentUser.id,
    eventType: 'employee.restored',
    entityType: 'employee',
    entityId: employeeId,
    description: `${currentUser.name} restored employee ${employee.name}.`,
    metadata: {
      name: employee.name,
      pay_type: employee.pay_type,
      hourly_rate: Number(employee.hourly_rate || 0),
      annual_salary: Number(employee.annual_salary || 0),
    },
    ipAddress: resolveRequestIp(c),
  });

  return c.redirect('/employees?show_archived=1');
});

export default employeeRoutes;