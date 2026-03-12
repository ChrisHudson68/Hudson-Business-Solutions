import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as userQueries from '../db/queries/users.js';
import { roleRequired } from '../middleware/auth.js';
import { hashPassword } from '../services/password.js';
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

function getTenantUserById(db: any, userId: number, tenantId: number) {
  return db
    .prepare(
      `
        SELECT id, name, email, role, active
        FROM users
        WHERE id = ? AND tenant_id = ?
      `,
    )
    .get(userId, tenantId) as
    | { id: number; name: string; email: string; role: string; active: number }
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

function renderAddUserError(c: any, error: string, formData: { name: string; email: string; role: string }) {
  return renderAppLayout(
    c,
    'Add User',
    <AddUserPage error={error} formData={formData} csrfToken={c.get('csrfToken')} />,
    400,
  );
}

function renderEditUserError(
  c: any,
  error: string,
  user: { id: number; name: string; email: string; role: string; active: number },
  formData?: EditUserFormData,
) {
  return renderAppLayout(
    c,
    'Edit User',
    <EditUserPage
      user={user}
      formData={formData}
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
  const users = userQueries.listByTenant(db, tenant.id);

  return renderAppLayout(c, 'Users', <UsersPage users={users} />);
});

userRoutes.get('/add_user', roleRequired('Admin'), (c) => {
  return renderAppLayout(
    c,
    'Add User',
    <AddUserPage
      formData={{ name: '', email: '', role: 'Employee' }}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

userRoutes.post('/add_user', roleRequired('Admin'), async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  const body = (await c.req.parseBody()) as Record<string, unknown>;

  const formData = {
    name: String(body['name'] ?? '').trim(),
    email: String(body['email'] ?? '').trim().toLowerCase(),
    role: String(body['role'] ?? 'Employee').trim(),
  };

  try {
    const name = requireMaxLength(body['name'], 'Name', 120);
    const email = requireEmail(body['email'], 'Email');
    const role = requireEnumValue(body['role'] ?? 'Employee', ALLOWED_ROLES, 'Role');
    const password = validatePassword(body['password']);

    const db = getDb();

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

    userQueries.create(db, {
      name,
      email,
      password_hash: hashPassword(password),
      role,
      tenant_id: tenant.id,
    });

    return c.redirect('/users');
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to create user right now.';
    return renderAddUserError(c, message, formData);
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

  if (!user) {
    return c.text('User not found', 404);
  }

  return renderAppLayout(
    c,
    'Edit User',
    <EditUserPage user={user} csrfToken={c.get('csrfToken')} />,
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

  if (!existingUser) {
    return c.text('User not found', 404);
  }

  const body = (await c.req.parseBody()) as Record<string, unknown>;

  const formData: EditUserFormData = {
    name: String(body['name'] ?? '').trim(),
    email: String(body['email'] ?? '').trim().toLowerCase(),
    role: String(body['role'] ?? existingUser.role).trim(),
    active: parseActiveFlag(body['active']),
  };

  try {
    const name = requireMaxLength(body['name'], 'Name', 120);
    const email = requireEmail(body['email'], 'Email');
    const role = requireEnumValue(body['role'], ALLOWED_ROLES, 'Role');
    const active = parseActiveFlag(body['active']);
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

    userQueries.update(db, userId, tenant.id, { name, email, role, active });

    if (newPasswordRaw.trim()) {
      const validatedPassword = validatePassword(newPasswordRaw, 'New password');
      userQueries.updatePassword(db, userId, tenant.id, hashPassword(validatedPassword));
    }

    return c.redirect('/users');
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to update user right now.';

    return renderEditUserError(c, message, existingUser, formData);
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

    return renderEditUserError(c, message, user);
  }
});