import { Hono } from 'hono';
import type { AppEnv } from '../app-env.js';
import { getDb } from '../db/connection.js';
import * as userQueries from '../db/queries/users.js';
import { loginRequired, permissionRequired, userHasPermission } from '../middleware/auth.js';
import { hashPassword } from '../services/password.js';
import { logActivity, resolveRequestIp } from '../services/activity-log.js';
import { AppLayout } from '../pages/layouts/AppLayout.js';
import { UsersPage } from '../pages/users/UsersPage.js';
import { AddUserPage } from '../pages/users/AddUserPage.js';
import { EditUserPage } from '../pages/users/EditUserPage.js';
import { UserPermissionsPage } from '../pages/users/UserPermissionsPage.js';
import { MyAccountPage } from '../pages/users/MyAccountPage.js';
import {
  PERMISSIONS,
  canCustomizeUserPermissions,
  getPermissionGroups,
  getResolvedUserPermissions,
  getRolePresets,
  normalizeUserRole,
  saveUserPermissionOverrides,
  type PermissionKey,
  type PermissionOverrideValue,
} from '../services/permissions.js';
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
  permissionOverrides: Partial<Record<PermissionKey, PermissionOverrideValue>>;
};

type MyAccountFormData = {
  name: string;
  email: string;
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

function parsePermissionOverrideValue(value: unknown): PermissionOverrideValue {
  const normalized = String(value ?? 'default').trim().toLowerCase();
  if (normalized === 'allow' || normalized === 'deny') {
    return normalized;
  }
  return 'default';
}

function parsePermissionOverrideSelections(body: Record<string, unknown>): Partial<Record<PermissionKey, PermissionOverrideValue>> {
  const selections: Partial<Record<PermissionKey, PermissionOverrideValue>> = {};

  for (const permission of PERMISSIONS) {
    selections[permission] = parsePermissionOverrideValue(body[`permission_override_${permission}`]);
  }

  return selections;
}

function getEditUserViewModel(db: any, tenantId: number, userId: number, roleOverride?: string | null, overrideSelections?: Partial<Record<PermissionKey, PermissionOverrideValue>>) {
  const user = getTenantUserById(db, userId, tenantId);
  if (!user) {
    return null;
  }

  const effectiveResolution = getResolvedUserPermissions(
    roleOverride ?? user.role,
    tenantId,
    userId,
    db,
  );

  const selectedOverrides = overrideSelections ?? effectiveResolution.overrides;
  const selectedRole = roleOverride ?? user.role;
  const previewResolution = canCustomizeUserPermissions(selectedRole)
    ? getResolvedUserPermissions(selectedRole, tenantId, userId, db)
    : {
        permissions: getRolePresets(tenantId, db).find((preset) => preset.role === normalizeUserRole(selectedRole))?.permissions ?? [],
        rolePermissions: getRolePresets(tenantId, db).find((preset) => preset.role === normalizeUserRole(selectedRole))?.permissions ?? [],
        overrides: {},
      };

  let effectivePermissions = previewResolution.permissions;
  if (overrideSelections) {
    const rolePermissions = getRolePresets(tenantId, db).find((preset) => preset.role === normalizeUserRole(selectedRole))?.permissions ?? [];
    const resolved = new Set(rolePermissions);
    if (canCustomizeUserPermissions(selectedRole)) {
      for (const permission of PERMISSIONS) {
        const selection = overrideSelections[permission] ?? 'default';
        if (selection === 'allow') resolved.add(permission);
        if (selection === 'deny') resolved.delete(permission);
      }
    }
    effectivePermissions = [...resolved];
  }

  return {
    user,
    rolePermissions: getRolePresets(tenantId, db).find((preset) => preset.role === normalizeUserRole(selectedRole))?.permissions ?? [],
    effectivePermissions,
    overrideSelections: selectedOverrides,
  };
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
      rolePresets={getRolePresets()}
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
  rolePermissions: PermissionKey[],
  effectivePermissions: PermissionKey[],
  overrideSelections: Partial<Record<PermissionKey, PermissionOverrideValue>>,
  formData?: EditUserFormData,
) {
  const tenant = c.get('tenant');

  return renderAppLayout(
    c,
    'Edit User',
    <EditUserPage
      user={user}
      formData={formData}
      employeeOptions={employeeOptions}
      rolePresets={getRolePresets(tenant?.id)}
      permissionGroups={getPermissionGroups()}
      rolePermissions={rolePermissions}
      effectivePermissions={effectivePermissions}
      overrideSelections={overrideSelections}
      error={error}
      csrfToken={c.get('csrfToken')}
    />,
    400,
  );
}

function renderMyAccountError(
  c: any,
  currentUser: { id: number; name: string; email: string; role: string },
  error: string,
  formData?: MyAccountFormData,
  success?: string,
) {
  return renderAppLayout(
    c,
    'My Account',
    <MyAccountPage
      currentUser={currentUser}
      formData={formData}
      error={error}
      success={success}
      csrfToken={c.get('csrfToken')}
    />,
    400,
  );
}

export const userRoutes = new Hono<AppEnv>();

userRoutes.get('/users', permissionRequired('users.view'), (c) => {
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
    ORDER BY CASE u.role WHEN 'Admin' THEN 1 WHEN 'Manager' THEN 2 ELSE 3 END, u.name ASC
  `).all(tenant.id) as Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    active: number;
    employee_name: string | null;
  }>;

  const currentUser = c.get('user');

  return renderAppLayout(
    c,
    'Users',
    <UsersPage
      users={users.map((user) => ({ ...user, role: normalizeUserRole(user.role) }))}
      canCreateUsers={userHasPermission(currentUser, 'users.create')}
      canEditUsers={userHasPermission(currentUser, 'users.edit')}
      rolePresets={getRolePresets(tenant.id)}
    />,
  );
});

userRoutes.get('/users/permissions', permissionRequired('users.view'), (c) => {
  const currentUser = c.get('user');
  const tenant = c.get('tenant');

  return renderAppLayout(
    c,
    'Role Permissions',
    <UserPermissionsPage
      rolePresets={getRolePresets(tenant?.id)}
      permissionGroups={getPermissionGroups()}
      canCreateUsers={userHasPermission(currentUser, 'users.create')}
    />,
  );
});

userRoutes.get('/my-account', loginRequired, (c) => {
  const currentUser = c.get('user');
  if (!currentUser) return c.redirect('/login');

  return renderAppLayout(
    c,
    'My Account',
    <MyAccountPage
      currentUser={currentUser}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

userRoutes.post('/my-account', loginRequired, async (c) => {
  const tenant = c.get('tenant');
  const currentUser = c.get('user');
  if (!tenant || !currentUser) return c.redirect('/login');

  const db = getDb();
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  const formData: MyAccountFormData = {
    name: String(body['name'] ?? '').trim(),
    email: currentUser.email,
  };

  try {
    const name = requireMaxLength(body['name'], 'Name', 120);
    const newPasswordRaw = String(body['new_password'] ?? '').trim();
    const confirmPasswordRaw = String(body['confirm_password'] ?? '').trim();

    db.prepare(`
      UPDATE users
      SET name = ?
      WHERE id = ? AND tenant_id = ?
    `).run(name, currentUser.id, tenant.id);

    let passwordChanged = false;

    if (newPasswordRaw || confirmPasswordRaw) {
      if (newPasswordRaw !== confirmPasswordRaw) {
        throw new ValidationError('New password and confirm password must match.');
      }

      const validatedPassword = validatePassword(newPasswordRaw, 'New password');
      userQueries.updatePassword(db, currentUser.id, tenant.id, hashPassword(validatedPassword));
      passwordChanged = true;
    }

    logActivity(db, {
      tenantId: tenant.id,
      actorUserId: currentUser.id,
      eventType: passwordChanged ? 'user.account_updated_with_password' : 'user.account_updated',
      entityType: 'user',
      entityId: currentUser.id,
      description: passwordChanged
        ? `${currentUser.name} updated their account details and password.`
        : `${currentUser.name} updated their account details.`,
      metadata: {
        name_before: currentUser.name,
        name_after: name,
        password_changed: passwordChanged,
      },
      ipAddress: resolveRequestIp(c),
    });

    const refreshedUser = getTenantUserById(db, currentUser.id, tenant.id);

    return renderAppLayout(
      c,
      'My Account',
      <MyAccountPage
        currentUser={{
          id: currentUser.id,
          name: refreshedUser?.name || name,
          email: currentUser.email,
          role: currentUser.role,
        }}
        formData={{
          name: refreshedUser?.name || name,
          email: currentUser.email,
        }}
        success={passwordChanged ? 'Your profile and password were updated.' : 'Your profile was updated.'}
        csrfToken={c.get('csrfToken')}
      />,
    );
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to update your account right now.';

    return renderMyAccountError(
      c,
      {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      },
      message,
      formData,
    );
  }
});

userRoutes.get('/add_user', permissionRequired('users.create'), (c) => {
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
      rolePresets={getRolePresets(tenant.id)}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

userRoutes.post('/add_user', permissionRequired('users.create'), async (c) => {
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

userRoutes.get('/edit_user/:id', permissionRequired('users.edit'), (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.redirect('/login');

  let userId: number;
  try {
    userId = parsePositiveInt(c.req.param('id'), 'User');
  } catch {
    return c.text('User not found', 404);
  }

  const db = getDb();
  const viewModel = getEditUserViewModel(db, tenant.id, userId);
  const employeeOptions = getEmployeeOptions(db, tenant.id);

  if (!viewModel) {
    return c.text('User not found', 404);
  }

  return renderAppLayout(
    c,
    'Edit User',
    <EditUserPage
      user={viewModel.user}
      employeeOptions={employeeOptions}
      rolePresets={getRolePresets(tenant.id)}
      permissionGroups={getPermissionGroups()}
      rolePermissions={viewModel.rolePermissions}
      effectivePermissions={viewModel.effectivePermissions}
      overrideSelections={viewModel.overrideSelections}
      csrfToken={c.get('csrfToken')}
    />,
  );
});

userRoutes.post('/edit_user/:id', permissionRequired('users.edit'), async (c) => {
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
  const permissionOverrides = parsePermissionOverrideSelections(body);

  const formData: EditUserFormData = {
    name: String(body['name'] ?? '').trim(),
    email: String(body['email'] ?? '').trim().toLowerCase(),
    role: String(body['role'] ?? existingUser.role).trim(),
    active: parseActiveFlag(body['active']),
    employee_id: String(body['employee_id'] ?? '').trim(),
    permissionOverrides,
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

    if (existingUser.active === 1 && active === 0 && !userHasPermission(currentUser, 'users.deactivate')) {
      throw new ValidationError('You do not have permission to deactivate users.');
    }

    const activeAdminCount = countActiveAdmins(db, tenant.id);
    const targetWasActiveAdmin = existingUser.role === 'Admin' && existingUser.active === 1;
    const targetWillStopBeingActiveAdmin = targetWasActiveAdmin && (role !== 'Admin' || active !== 1);

    if (targetWillStopBeingActiveAdmin && activeAdminCount <= 1) {
      throw new ValidationError('Your company must have at least one active Admin user.');
    }

    if (role === 'Employee' && employeeId === null) {
      throw new ValidationError('Employee users must be linked to an employee record.');
    }

    const before = {
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      active: existingUser.active,
      employee_id: existingUser.employee_id,
      permission_overrides: getResolvedUserPermissions(existingUser.role, tenant.id, userId, db).overrides,
      effective_permissions: getResolvedUserPermissions(existingUser.role, tenant.id, userId, db).permissions,
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

    saveUserPermissionOverrides(db, tenant.id, userId, role, permissionOverrides);

    const afterResolution = getResolvedUserPermissions(role, tenant.id, userId, db);
    const after = {
      name,
      email,
      role,
      active,
      employee_id: employeeId,
      permission_overrides: afterResolution.overrides,
      effective_permissions: afterResolution.permissions,
    };

    const changedGeneral =
      before.name !== after.name ||
      before.email !== after.email ||
      before.employee_id !== after.employee_id;

    const changedRole = before.role !== after.role;
    const changedActivation = before.active !== after.active;
    const changedPermissions = JSON.stringify(before.permission_overrides) !== JSON.stringify(after.permission_overrides);

    if (changedGeneral) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: currentUser.id,
        eventType: 'user.updated',
        entityType: 'user',
        entityId: userId,
        description: `${currentUser.name} updated user ${name}.`,
        metadata: {
          before,
          after,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    if (changedRole) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: currentUser.id,
        eventType: 'user.role_changed',
        entityType: 'user',
        entityId: userId,
        description: `${currentUser.name} changed ${name}'s role from ${before.role} to ${after.role}.`,
        metadata: {
          before_role: before.role,
          after_role: after.role,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    if (changedActivation) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: currentUser.id,
        eventType: after.active === 1 ? 'user.activated' : 'user.deactivated',
        entityType: 'user',
        entityId: userId,
        description:
          after.active === 1
            ? `${currentUser.name} activated user ${name}.`
            : `${currentUser.name} deactivated user ${name}.`,
        metadata: {
          before_active: before.active,
          after_active: after.active,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    if (changedPermissions) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: currentUser.id,
        eventType: 'user.permissions_updated',
        entityType: 'user',
        entityId: userId,
        description: `${currentUser.name} updated permission overrides for ${name}.`,
        metadata: {
          before_overrides: before.permission_overrides,
          after_overrides: after.permission_overrides,
          before_effective_permissions: before.effective_permissions,
          after_effective_permissions: after.effective_permissions,
        },
        ipAddress: resolveRequestIp(c),
      });
    }

    if (newPasswordRaw.trim()) {
      logActivity(db, {
        tenantId: tenant.id,
        actorUserId: currentUser.id,
        eventType: 'user.password_reset',
        entityType: 'user',
        entityId: userId,
        description: `${currentUser.name} reset the password for ${name}.`,
        metadata: {},
        ipAddress: resolveRequestIp(c),
      });
    }

    return c.redirect('/users');
  } catch (error) {
    const message =
      error instanceof ValidationError ? error.message : 'Unable to update user right now.';
    const viewModel = getEditUserViewModel(db, tenant.id, userId, formData.role, permissionOverrides);

    return renderEditUserError(
      c,
      message,
      viewModel?.user ?? existingUser,
      employeeOptions,
      viewModel?.rolePermissions ?? getRolePresets(tenant.id).find((preset) => preset.role === normalizeUserRole(formData.role))?.permissions ?? [],
      viewModel?.effectivePermissions ?? [],
      viewModel?.overrideSelections ?? permissionOverrides,
      formData,
    );
  }
});

export default userRoutes;
