import { getDb, type DB } from '../db/connection.js';

export const PERMISSIONS = [
  'jobs.view',
  'jobs.create',
  'jobs.edit',
  'jobs.archive',
  'employees.view',
  'employees.create',
  'employees.edit',
  'employees.archive',
  'time.view',
  'time.clock',
  'time.edit_requests',
  'time.approve',
  'invoices.view',
  'invoices.create',
  'invoices.edit',
  'invoices.archive',
  'payments.manage',
  'fleet.view',
  'fleet.manage',
  'financials.view',
  'financials.edit',
  'reports.view',
  'activity.view',
  'settings.view',
  'settings.manage',
  'users.view',
  'users.create',
  'users.edit',
  'users.deactivate',
  'billing.view',
  'billing.manage',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];
export type UserRole = 'Admin' | 'Manager' | 'Employee';
export type PermissionOverrideValue = 'default' | 'allow' | 'deny';

export const ROLE_ORDER: readonly UserRole[] = ['Admin', 'Manager', 'Employee'] as const;
export const CONFIGURABLE_ROLES: readonly UserRole[] = ['Manager', 'Employee'] as const;
export const USER_OVERRIDE_CONFIGURABLE_ROLES: readonly UserRole[] = ['Manager', 'Employee'] as const;

const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, readonly PermissionKey[]> = {
  Admin: PERMISSIONS,
  Manager: [
    'jobs.view',
    'jobs.create',
    'jobs.edit',
    'employees.view',
    'employees.create',
    'employees.edit',
    'time.view',
    'time.clock',
    'time.edit_requests',
    'time.approve',
    'invoices.view',
    'invoices.create',
    'invoices.edit',
    'payments.manage',
  'fleet.view',
  'fleet.manage',
    'financials.view',
    'financials.edit',
    'reports.view',
    'activity.view',
    'settings.view',
    'users.view',
    'billing.view',
  ],
  Employee: [
    'time.view',
    'time.clock',
    'time.edit_requests',
  ],
};

const LEGACY_ROLE_FALLBACK: UserRole = 'Employee';

export interface RolePreset {
  role: UserRole;
  label: UserRole;
  description: string;
  permissionCount: number;
  permissions: PermissionKey[];
  highlights: string[];
  customized: boolean;
}

export interface EffectivePermissionResolution {
  permissions: PermissionKey[];
  rolePermissions: PermissionKey[];
  overrides: Record<PermissionKey, PermissionOverrideValue>;
}

export interface UserPermissionOverrideRow {
  permission_key: string;
  allowed: number;
}

function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  const normalized = String(role ?? '').trim();
  if (normalized === 'Admin' || normalized === 'Manager' || normalized === 'Employee') {
    return normalized;
  }
  return LEGACY_ROLE_FALLBACK;
}

export function getDefaultRolePermissions(role: string | null | undefined): PermissionKey[] {
  return [...DEFAULT_ROLE_PERMISSIONS[normalizeUserRole(role)]];
}

export function isConfigurableRole(role: string | null | undefined): boolean {
  return CONFIGURABLE_ROLES.includes(normalizeUserRole(role));
}

export function canCustomizeUserPermissions(role: string | null | undefined): boolean {
  return USER_OVERRIDE_CONFIGURABLE_ROLES.includes(normalizeUserRole(role));
}

type TenantRolePermissionRow = {
  role: string;
  permission_key: string;
  allowed: number;
};

function getTenantRolePermissionRows(db: DB, tenantId: number): TenantRolePermissionRow[] {
  return db.prepare(`
    SELECT role, permission_key, allowed
    FROM tenant_role_permissions
    WHERE tenant_id = ?
  `).all(tenantId) as TenantRolePermissionRow[];
}

export function getTenantRolePermissionMap(
  tenantId: number,
  db: DB = getDb(),
): Record<UserRole, PermissionKey[]> {
  const map: Record<UserRole, PermissionKey[]> = {
    Admin: getDefaultRolePermissions('Admin'),
    Manager: getDefaultRolePermissions('Manager'),
    Employee: getDefaultRolePermissions('Employee'),
  };

  const rows = getTenantRolePermissionRows(db, tenantId);
  if (rows.length === 0) {
    return map;
  }

  for (const role of CONFIGURABLE_ROLES) {
    const roleRows = rows.filter((row) => normalizeUserRole(row.role) === role);
    if (roleRows.length === 0) continue;

    map[role] = roleRows
      .filter((row) => row.allowed === 1 && isPermissionKey(row.permission_key))
      .map((row) => row.permission_key as PermissionKey);
  }

  return map;
}

export function getRolePermissions(
  role: string | null | undefined,
  tenantId?: number | null,
  db: DB = getDb(),
): PermissionKey[] {
  const normalized = normalizeUserRole(role);
  if (normalized === 'Admin' || !tenantId || !isConfigurableRole(normalized)) {
    return getDefaultRolePermissions(normalized);
  }

  return getTenantRolePermissionMap(tenantId, db)[normalized];
}

export function getUserPermissionOverrideRows(
  db: DB,
  tenantId: number,
  userId: number,
): UserPermissionOverrideRow[] {
  return db.prepare(`
    SELECT permission_key, allowed
    FROM user_permission_overrides
    WHERE tenant_id = ? AND user_id = ?
  `).all(tenantId, userId) as UserPermissionOverrideRow[];
}

export function getUserPermissionOverrideMap(
  tenantId: number,
  userId: number,
  db: DB = getDb(),
): Record<PermissionKey, PermissionOverrideValue> {
  const overrides = {} as Record<PermissionKey, PermissionOverrideValue>;
  const rows = getUserPermissionOverrideRows(db, tenantId, userId);

  for (const row of rows) {
    if (!isPermissionKey(row.permission_key)) continue;
    overrides[row.permission_key] = row.allowed === 1 ? 'allow' : 'deny';
  }

  return overrides;
}

export function getResolvedUserPermissions(
  role: string | null | undefined,
  tenantId: number | null | undefined,
  userId: number | null | undefined,
  db: DB = getDb(),
): EffectivePermissionResolution {
  const normalizedRole = normalizeUserRole(role);
  const rolePermissions = getRolePermissions(normalizedRole, tenantId, db);
  const rolePermissionSet = new Set<PermissionKey>(rolePermissions);
  const resolvedSet = new Set<PermissionKey>(rolePermissions);
  const overrides = {} as Record<PermissionKey, PermissionOverrideValue>;

  if (!tenantId || !userId || !canCustomizeUserPermissions(normalizedRole)) {
    return {
      permissions: [...resolvedSet],
      rolePermissions: [...rolePermissionSet],
      overrides,
    };
  }

  const overrideRows = getUserPermissionOverrideRows(db, tenantId, userId);
  for (const row of overrideRows) {
    if (!isPermissionKey(row.permission_key)) continue;

    if (row.allowed === 1) {
      resolvedSet.add(row.permission_key);
      overrides[row.permission_key] = 'allow';
    } else {
      resolvedSet.delete(row.permission_key);
      overrides[row.permission_key] = 'deny';
    }
  }

  return {
    permissions: [...resolvedSet],
    rolePermissions: [...rolePermissionSet],
    overrides,
  };
}

export function saveTenantRolePermissions(
  db: DB,
  tenantId: number,
  role: UserRole,
  allowedPermissions: readonly PermissionKey[],
): void {
  const normalized = normalizeUserRole(role);
  if (!isConfigurableRole(normalized)) {
    throw new Error('Only Manager and Employee permissions can be customized.');
  }

  const allowedSet = new Set(allowedPermissions);
  const insert = db.prepare(`
    INSERT INTO tenant_role_permissions (tenant_id, role, permission_key, allowed, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_id, role, permission_key)
    DO UPDATE SET allowed = excluded.allowed, updated_at = CURRENT_TIMESTAMP
  `);
  const clear = db.prepare(`DELETE FROM tenant_role_permissions WHERE tenant_id = ? AND role = ?`);

  const transaction = db.transaction(() => {
    clear.run(tenantId, normalized);
    for (const permission of PERMISSIONS) {
      insert.run(tenantId, normalized, permission, allowedSet.has(permission) ? 1 : 0);
    }
  });

  transaction();
}

export function resetTenantRolePermissions(db: DB, tenantId: number, role: UserRole): void {
  const normalized = normalizeUserRole(role);
  if (!isConfigurableRole(normalized)) {
    throw new Error('Only Manager and Employee permissions can be reset.');
  }

  db.prepare('DELETE FROM tenant_role_permissions WHERE tenant_id = ? AND role = ?').run(tenantId, normalized);
}

export function saveUserPermissionOverrides(
  db: DB,
  tenantId: number,
  userId: number,
  role: string | null | undefined,
  overrideSelections: Partial<Record<PermissionKey, PermissionOverrideValue>>,
): void {
  const normalizedRole = normalizeUserRole(role);
  const clear = db.prepare('DELETE FROM user_permission_overrides WHERE tenant_id = ? AND user_id = ?');

  if (!canCustomizeUserPermissions(normalizedRole)) {
    clear.run(tenantId, userId);
    return;
  }

  const insert = db.prepare(`
    INSERT INTO user_permission_overrides (tenant_id, user_id, permission_key, allowed, created_at, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_id, user_id, permission_key)
    DO UPDATE SET allowed = excluded.allowed, updated_at = CURRENT_TIMESTAMP
  `);

  const transaction = db.transaction(() => {
    clear.run(tenantId, userId);

    for (const permission of PERMISSIONS) {
      const selection = overrideSelections[permission] ?? 'default';
      if (selection === 'allow') {
        insert.run(tenantId, userId, permission, 1);
      } else if (selection === 'deny') {
        insert.run(tenantId, userId, permission, 0);
      }
    }
  });

  transaction();
}

export function hasPermission(
  roleOrPermissions: string | readonly string[] | null | undefined,
  permission: PermissionKey,
): boolean {
  if (Array.isArray(roleOrPermissions)) {
    return roleOrPermissions.includes(permission);
  }
  return getRolePermissions(roleOrPermissions as string | null | undefined).includes(permission);
}

export function hasAnyPermission(
  roleOrPermissions: string | readonly string[] | null | undefined,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.some((permission) => hasPermission(roleOrPermissions, permission));
}

export function hasAllPermissions(
  roleOrPermissions: string | readonly string[] | null | undefined,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.every((permission) => hasPermission(roleOrPermissions, permission));
}

export function describeRole(role: string | null | undefined): string {
  const normalized = normalizeUserRole(role);
  if (normalized === 'Admin') return 'Full tenant control';
  if (normalized === 'Manager') return 'Operational access without full company control';
  return 'Limited self-service workspace access';
}

export function getPermissionGroups(): Array<{
  label: string;
  permissions: PermissionKey[];
}> {
  return [
    {
      label: 'Jobs',
      permissions: ['jobs.view', 'jobs.create', 'jobs.edit', 'jobs.archive'],
    },
    {
      label: 'Employees',
      permissions: ['employees.view', 'employees.create', 'employees.edit', 'employees.archive'],
    },
    {
      label: 'Time',
      permissions: ['time.view', 'time.clock', 'time.edit_requests', 'time.approve'],
    },
    {
      label: 'Invoices & Payments',
      permissions: ['invoices.view', 'invoices.create', 'invoices.edit', 'invoices.archive', 'payments.manage'],
    },
    {
      label: 'Fleet, Financials & Reports',
      permissions: ['fleet.view', 'fleet.manage', 'financials.view', 'financials.edit', 'reports.view', 'activity.view'],
    },
    {
      label: 'Users, Billing & Settings',
      permissions: ['users.view', 'users.create', 'users.edit', 'users.deactivate', 'billing.view', 'billing.manage', 'settings.view', 'settings.manage'],
    },
  ];
}

export function formatPermissionLabel(permission: PermissionKey): string {
  const [group, action] = permission.split('.');
  const groupLabel =
    group === 'jobs'
      ? 'Jobs'
      : group === 'employees'
        ? 'Employees'
        : group === 'time'
          ? 'Time'
          : group === 'invoices'
            ? 'Invoices'
            : group === 'payments'
              ? 'Payments'
              : group === 'financials'
                ? 'Financials'
                : group === 'reports'
                  ? 'Reports'
                  : group === 'activity'
                    ? 'Activity'
                    : group === 'settings'
                      ? 'Settings'
                      : group === 'users'
                        ? 'Users'
                        : group === 'billing'
                          ? 'Billing'
                          : group;

  const actionLabel =
    action === 'view'
      ? 'View'
      : action === 'create'
        ? 'Create'
        : action === 'edit'
          ? 'Edit'
          : action === 'archive'
            ? 'Archive'
            : action === 'clock'
              ? 'Clock In/Out'
              : action === 'edit_requests'
                ? 'Submit Edit Requests'
                : action === 'approve'
                  ? 'Approve & Manage'
                  : action === 'manage'
                    ? 'Manage'
                    : action === 'deactivate'
                      ? 'Deactivate'
                      : action;

  return `${groupLabel}: ${actionLabel}`;
}

export function getRoleHighlights(role: string | null | undefined): string[] {
  const normalized = normalizeUserRole(role);
  if (normalized === 'Admin') {
    return [
      'Full tenant administration',
      'Billing and settings control',
      'Archive and restore workflows',
      'User lifecycle management',
    ];
  }
  if (normalized === 'Manager') {
    return [
      'Daily operations management',
      'Create and edit jobs, employees, and invoices',
      'Approve time and manage financial entries',
      'View settings and billing without full control',
    ];
  }
  return [
    'Self-service time clock access',
    'Submit time edit requests',
    'View personal workspace tools only',
    'No billing, settings, or user admin access',
  ];
}

export function getRolePresets(tenantId?: number | null, db: DB = getDb()): RolePreset[] {
  const tenantMap = tenantId ? getTenantRolePermissionMap(tenantId, db) : null;

  return ROLE_ORDER.map((role) => {
    const permissions = tenantMap ? tenantMap[role] : getDefaultRolePermissions(role);
    const defaultPermissions = getDefaultRolePermissions(role);
    const customized =
      role !== 'Admin' &&
      (permissions.length !== defaultPermissions.length ||
        permissions.some((permission) => !defaultPermissions.includes(permission)));

    return {
      role,
      label: role,
      description: describeRole(role),
      permissionCount: permissions.length,
      permissions: [...permissions],
      highlights: getRoleHighlights(role),
      customized,
    };
  });
}
