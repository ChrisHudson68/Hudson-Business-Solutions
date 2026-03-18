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

const ROLE_PERMISSIONS: Record<UserRole, readonly PermissionKey[]> = {
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
    'financials.view',
    'financials.edit',
    'reports.view',
    'activity.view',
    'settings.view',
    'users.view',
    'billing.view',
  ],
  Employee: [
    'jobs.view',
    'time.view',
    'time.clock',
    'time.edit_requests',
    'invoices.view',
    'reports.view',
  ],
};

const LEGACY_ROLE_FALLBACK: UserRole = 'Employee';

export function normalizeUserRole(role: string | null | undefined): UserRole {
  const normalized = String(role ?? '').trim();
  if (normalized === 'Admin' || normalized === 'Manager' || normalized === 'Employee') {
    return normalized;
  }
  return LEGACY_ROLE_FALLBACK;
}

export function getRolePermissions(role: string | null | undefined): PermissionKey[] {
  return [...ROLE_PERMISSIONS[normalizeUserRole(role)]];
}

export function hasPermission(
  roleOrPermissions: string | readonly string[] | null | undefined,
  permission: PermissionKey,
): boolean {
  if (Array.isArray(roleOrPermissions)) {
    return roleOrPermissions.includes(permission);
  }
  return getRolePermissions(roleOrPermissions).includes(permission);
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
      label: 'Financials & Reports',
      permissions: ['financials.view', 'financials.edit', 'reports.view', 'activity.view'],
    },
    {
      label: 'Users, Billing & Settings',
      permissions: ['users.view', 'users.create', 'users.edit', 'users.deactivate', 'billing.view', 'billing.manage', 'settings.view', 'settings.manage'],
    },
  ];
}
