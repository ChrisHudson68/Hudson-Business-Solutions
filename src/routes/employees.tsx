import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import { roleRequired } from '../middleware/auth.js';
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

function buildEmployeeFormData(source: Record<string, unknown>) {
  return {
    name: String(source.name ?? ''),
    pay_type: String(source.pay_type ?? 'Hourly'),
    hourly_rate: String(source.hourly_rate ?? '0'),
    annual_salary: String(source.annual_salary ?? '0'),
    active: String(source.active ?? '1'),
  };
}

function normalizeEmployeeInput(body: Record<string, unknown>) {
  const name = requireName(body.name);
  const payType = parsePayType(body.pay_type);
  const hourlyRate = parseNonNegativeMoney(body.hourly_rate, 'Hourly rate');
  const annualSalary = parseNonNegativeMoney(body.annual_salary, 'Annual salary');

  if (payType === 'Hourly' && hourlyRate <= 0) {
    throw new Error('Hourly employees must have an hourly rate greater than 0.');
  }

  if (payType === 'Salary' && annualSalary <= 0) {
    throw new Error('Salary employees must have an annual salary greater than 0.');
  }

  return {
    name,
    pay_type: payType,
    hourly_rate: payType === 'Hourly' ? hourlyRate : 0,
    annual_salary: payType === 'Salary' ? annualSalary : 0,
  };
}

function getEmployeeById(db: any, employeeId: number, tenantId: number) {
  return db.prepare(`
    SELECT id, name, pay_type, hourly_rate, annual_salary, active
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
      }
    | undefined;
}

export const employeeRoutes = new Hono<AppEnv>();

employeeRoutes.get('/employees', roleRequired('Admin', 'Manager'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;

  const db = getDb();
  const employees = db.prepare(`
    SELECT id, name, pay_type, hourly_rate, annual_salary, active
    FROM employees
    WHERE tenant_id = ?
    ORDER BY active DESC, name ASC
  `).all(tenantId) as any[];

  return renderApp(
    c,
    'Employees',
    <EmployeesPage employees={employees} csrfToken={c.get('csrfToken')} />
  );
});

employeeRoutes.get('/add_employee', roleRequired('Admin', 'Manager'), (c) => {
  return renderApp(
    c,
    'Add Employee',
    <AddEmployeePage
      formData={{
        name: '',
        pay_type: 'Hourly',
        hourly_rate: '0',
        annual_salary: '0',
      }}
      csrfToken={c.get('csrfToken')}
    />
  );
});

employeeRoutes.post('/add_employee', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
  const tenantId = tenant.id;

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const formData = buildEmployeeFormData(body);

  try {
    const normalized = normalizeEmployeeInput(body);

    const db = getDb();
    db.prepare(`
      INSERT INTO employees (name, pay_type, hourly_rate, annual_salary, active, tenant_id)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(
      normalized.name,
      normalized.pay_type,
      normalized.hourly_rate,
      normalized.annual_salary,
      tenantId,
    );

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

employeeRoutes.get('/edit_employee/:id', roleRequired('Admin', 'Manager'), (c) => {
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
    <EditEmployeePage employee={emp} csrfToken={c.get('csrfToken')} />
  );
});

employeeRoutes.post('/edit_employee/:id', roleRequired('Admin', 'Manager'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');
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

    db.prepare(`
      UPDATE employees
      SET name = ?, pay_type = ?, hourly_rate = ?, annual_salary = ?, active = ?
      WHERE id = ? AND tenant_id = ?
    `).run(
      normalized.name,
      normalized.pay_type,
      normalized.hourly_rate,
      normalized.annual_salary,
      active,
      employeeId,
      tenantId,
    );

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
          name: formData.name,
          pay_type: formData.pay_type,
          hourly_rate: formData.hourly_rate,
          annual_salary: formData.annual_salary,
          active: formData.active === '1' ? 1 : 0,
        }}
        error={message}
        csrfToken={c.get('csrfToken')}
      />,
      400,
    );
  }
});

export default employeeRoutes;