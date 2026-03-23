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

export const ROLE_ORDER: readonly UserRole[] = ['Admin', 'Manager', 'Employee'] as const;

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
    'time.view',
    'time.clock',
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
  return getRolePermissions(typeof roleOrPermissions === 'string' ? roleOrPermissions : null).includes(permission);
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
  return 'Time clock only with self-service account access';
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
      'Create and edit jobs, employees, invoices, and estimates',
      'Approve time and manage financial entries',
      'View settings and billing without full control',
    ];
  }
  return [
    'Clock in and clock out',
    'Open the timesheet workspace',
    'Manage their own password from My Account',
    'No job, invoice, financial, report, billing, or user admin access',
  ];
}

export function getRolePresets(): Array<{
  role: UserRole;
  label: UserRole;
  description: string;
  permissionCount: number;
  permissions: PermissionKey[];
  highlights: string[];
}> {
  return ROLE_ORDER.map((role) => ({
    role,
    label: role,
    description: describeRole(role),
    permissionCount: getRolePermissions(role).length,
    permissions: getRolePermissions(role),
    highlights: getRoleHighlights(role),
  }));
}
