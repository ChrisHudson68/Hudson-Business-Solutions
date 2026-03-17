import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as userQueries from '../db/queries/users.js';
import { roleRequired } from '../middleware/auth.js';
import { hashPassword } from '../services/password.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { UsersPage } from '../pages/users/UsersPage.js';
import { AddUserPage } from '../pages/users/AddUserPage.js';
import { EditUserPage } from '../pages/users/EditUserPage.js';
import {
  ValidationError,
  parsePositiveInt,
  requireEmail,
  requireEnumValue,
  requireMaxLength,
  validatePassword,
} from '../lib/validation.js';

type UserRole = 'Admin' | 'Manager' | 'Employee';

const ALLOWED_ROLES: readonly UserRole[] = ['Admin', 'Manager', 'Employee'] as const;

type EditUserFormData = {
  name: string;
  email: string;
  role: string;
  active: number;
  employee_id: string;
};

function renderAppLayout(c: any, subtitle: string, children: any, status: 200 | 400 | 404 = 200) {
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
      {children}
    </AppLayout>,
    status as any,
  );
}

function getEmployeeOptions(db: any, tenantId: number) {
  return db.prepare(`
    SELECT id, name
    FROM employees
    WHERE tenant_id = ? AND active = 1
    ORDER BY name ASC
  `).all(tenantId) as Array<{ id: number; name: string }>;
}

function parseOptionalEmployeeId(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return parsePositiveInt(raw, 'Employee');
}

function validateEmployeeLink(db: any, tenantId: number, employeeId: number | null) {
  if (employeeId === null) return null;

  const employee = db.prepare(`
    SELECT id
    FROM employees
    WHERE id = ? AND tenant_id = ? AND active = 1
    LIMIT 1
  `).get(employeeId, tenantId) as { id: number } | undefined;

  if (!employee) {
    throw new ValidationError('Selected employee link is invalid.');
  }

  return employeeId;
}

function getTenantUserById(db: any, userId: number, tenantId: number) {
  return db
    .prepare(
      `
        SELECT id, name, email, role, active, employee_id
        FROM users
        WHERE id = ? AND tenant_id = ?
      `,
    )
    .get(userId, tenantId) as
    | { id: number; name: string; email: string; role: string; active: number; employee_id: number | null }
    | undefined;
}

function countActiveAdmins(db: any, tenantId: number): number {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) as total
        FROM users
        WHERE tenant_id = ? AND role = 'Admin' AND active = 1
      `,
    )
    .get(tenantId) as { total: number };

  return Number(row?.total || 0);
}

function parseActiveFlag(value: unknown): number {
  return value === '0' ? 0 : 1;
}

function renderAddUserError(
  c: any,
  error: string,
  formData: { name: string; email: string; role: string; employee_id: string },
  employeeOptions: Array<{ id: number; name: string }>,
) {
  return renderAppLayout(
    c,
    'Add User',
    <AddUserPage
      error={error}
      formData={formData}
      employeeOptions={employeeOptions}
      csrfToken={c.get('csrfToken')}
    />,
    400,
  );
}

function renderEditUserError(
  c: any,
  error: string,
  user: { id: number; name: string; email: string; role: string; active: number; employee_id: number | null },
  employeeOptions: Array<{ id: number; name: string }>,
  formData?: EditUserFormData,
) {
  return renderAppLayout(
    c,
    'Edit User',
    <EditUserPage
      user={user}
      formData={formData}
      employeeOptions={employeeOptions}
      error={error}
      csrfToken={c.get('csrfToken')}
    />,
    400,
  );
}

export const userRoutes = new Hono<AppEnv>();

userRoutes.get('/users', roleRequired('Admin'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.active, e.name AS employee_name
    FROM users u
    LEFT JOIN employees e
      ON e.id = u.employee_id
     AND e.tenant_id = u.tenant_id
    WHERE u.tenant_id = ?
    ORDER BY u.role ASC, u.name ASC
  `).all(tenant.id) as Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    active: number;
    employee_name: string | null;
  }>;

  return renderAppLayout(c, 'Users', <UsersPage users={users} />);
});

userRoutes.get('/add_user', roleRequired('Admin'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const db = getDb();
  const employeeOptions = getEmployeeOptions(db, tenant.id);

  return renderAppLayout(
    c,
    'Add User',
    <AddUserPage
      formData={{ name: '', email: '', role: 'Employee', employee_id: '' }}
      employeeOptions={employeeOptions}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

userRoutes.post('/add_user', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const db = getDb();
  const employeeOptions = getEmployeeOptions(db, tenant.id);

  const formData = {
    name: String(body['name'] ?? '').trim(),
    email: String(body['email'] ?? '').trim().toLowerCase(),
    role: String(body['role'] ?? 'Employee').trim(),
    employee_id: String(body['employee_id'] ?? '').trim(),
  };

  try {
    const name = requireMaxLength(body['name'], 'Name', 120);
    const email = requireEmail(body['email'], 'Email');
    const role = requireEnumValue(body['role'] ?? 'Employee', ALLOWED_ROLES, 'Role');
    const password = validatePassword(body['password']);
    const employeeId = validateEmployeeLink(db, tenant.id, parseOptionalEmployeeId(body['employee_id']));

    const existingTenantUser = db
      .prepare(
        `
          SELECT id
          FROM users
          WHERE tenant_id = ? AND lower(email) = lower(?)
          LIMIT 1
        `,
      )
      .get(tenant.id, email) as { id: number } | undefined;

    if (existingTenantUser) {
      throw new ValidationError('That email already exists for this company.');
    }

    if (role === 'Employee' && employeeId === null) {
      throw new ValidationError('Employee users must be linked to an employee record.');
    }

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, active, tenant_id, employee_id)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(name, email, hashPassword(password), role, tenant.id, employeeId);

    const newUserId = Number(result.lastInsertRowid);

    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: currentUser.id,
      eventType: 'user.created',
      entityType: 'user',
      entityId: newUserId,
      description: `${currentUser.name} created user ${name}.`,
      metadata: {
        name,
        email,
        role,
        active: 1,
        employee_id: employeeId,
      },
      ipAddress: resolveRequestIp(c),
    });

    return c.redirect('/users');
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to create user right now.';
    return renderAddUserError(c, message, formData, employeeOptions);
  }
});

userRoutes.get('/edit_user/:id', roleRequired('Admin'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  let userId: number;
  try {
    userId = parsePositiveInt(c.req.param('id'), 'User');
  } catch {
    return c.text('User not found', 404);
  }

  const db = getDb();
  const user = getTenantUserById(db, userId, tenant.id);
  const employeeOptions = getEmployeeOptions(db, tenant.id);

  if (!user) {
    return c.text('User not found', 404);
  }

  return renderAppLayout(
    c,
    'Edit User',
    <EditUserPage
      user={user}
      employeeOptions={employeeOptions}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

userRoutes.post('/edit_user/:id', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  let userId: number;
  try {
    userId = parsePositiveInt(c.req.param('id'), 'User');
  } catch {
    return c.text('User not found', 404);
  }

  const db = getDb();
  const existingUser = getTenantUserById(db, userId, tenant.id);
  const employeeOptions = getEmployeeOptions(db, tenant.id);

  if (!existingUser) {
    return c.text('User not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;

  const formData: EditUserFormData = {
    name: String(body['name'] ?? '').trim(),
    email: String(body['email'] ?? '').trim().toLowerCase(),
    role: String(body['role'] ?? existingUser.role).trim(),
    active: parseActiveFlag(body['active']),
    employee_id: String(body['employee_id'] ?? '').trim(),
  };

  try {
    const name = requireMaxLength(body['name'], 'Name', 120);
    const email = requireEmail(body['email'], 'Email');
    const role = requireEnumValue(body['role'], ALLOWED_ROLES, 'Role');
    const active = parseActiveFlag(body['active']);
    const employeeId = validateEmployeeLink(db, tenant.id, parseOptionalEmployeeId(body['employee_id']));
    const newPasswordRaw = String(body['new_password'] ?? '');

    const duplicateUser = db
      .prepare(
        `
          SELECT id
          FROM users
          WHERE tenant_id = ? AND lower(email) = lower(?) AND id != ?
          LIMIT 1
        `,
      )
      .get(tenant.id, email, userId) as { id: number } | undefined;

    if (duplicateUser) {
      throw new ValidationError('That email already exists for this company.');
    }

    const editingSelf = currentUser.id === userId;

    if (editingSelf && active === 0) {
      throw new ValidationError('You cannot deactivate your own account.');
    }

    if (editingSelf && role !== 'Admin') {
      throw new ValidationError('You cannot remove your own Admin role.');
    }

    const activeAdminCount = countActiveAdmins(db, tenant.id);
    const targetWasActiveAdmin = existingUser.role === 'Admin' && existingUser.active === 1;
    const targetWillStopBeingActiveAdmin = targetWasActiveAdmin && (role !== 'Admin' || active !== 1);

    if (targetWillStopBeingActiveAdmin && activeAdminCount <= 1) {
      throw new ValidationError('Your company must have at least one active Admin user.');
    }

    const before = {
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      active: existingUser.active,
      employee_id: existingUser.employee_id,
    };

    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, role = ?, active = ?, employee_id = ?
      WHERE id = ? AND tenant_id = ?
    `).run(name, email, role, active, employeeId, userId, tenant.id);

    if (newPasswordRaw.trim()) {
      const validatedPassword = validatePassword(newPasswordRaw, 'New password');
      userQueries.updatePassword(db, userId, tenant.id, hashPassword(validatedPassword));
    }

    const after = {
      name,
      email,
      role,
      active,
      employee_id: employeeId,
    };

    const changedGeneral =
      before.name !== after.name ||
      before.email !== after.email ||
      before.employee_id !== after.employee_id;

    if (changedGeneral) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: currentUser.id,
        eventType: 'user.updated',
        entityType: 'user',
        entityId: userId,
        description: `${currentUser.name} updated user ${name}.`,
        metadata: { before, after },
        ipAddress: resolveRequestIp(c),
      });
    }

    if (before.role !== after.role) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: currentUser.id,
        eventType: 'user.role_changed',
        entityType: 'user',
        entityId: userId,
        description: `${currentUser.name} changed ${name}'s role from ${before.role} to ${after.role}.`,
        metadata: { before_role: before.role, after_role: after.role },
        ipAddress: resolveRequestIp(c),
      });
    }

    if (before.active !== after.active) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: currentUser.id,
        eventType: after.active === 1 ? 'user.reactivated' : 'user.deactivated',
        entityType: 'user',
        entityId: userId,
        description: `${currentUser.name} ${after.active === 1 ? 'reactivated' : 'deactivated'} user ${name}.`,
        metadata: { before_active: before.active, after_active: after.active },
        ipAddress: resolveRequestIp(c),
      });
    }

    return c.redirect('/users');
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to update user right now.';

    return renderEditUserError(c, message, existingUser, employeeOptions, formData);
  }
});

userRoutes.post('/reset_password/:id', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  let userId: number;
  try {
    userId = parsePositiveInt(c.req.param('id'), 'User');
  } catch {
    return c.text('User not found', 404);
  }

  const db = getDb();
  const user = getTenantUserById(db, userId, tenant.id);
  const employeeOptions = getEmployeeOptions(db, tenant.id);

  if (!user) {
    return c.text('User not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;

  try {
    const newPassword = validatePassword(body['new_password'], 'New password');
    userQueries.updatePassword(db, userId, tenant.id, hashPassword(newPassword));
    return c.redirect(`/edit_user/${userId}`);
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to reset password right now.';

    return renderEditUserError(c, message, user, employeeOptions);
  }
});

export default userRoutes;