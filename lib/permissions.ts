// ─────────────────────────────────────────────────────────────────────────────
// Access control — granular, role-based permissions with per-user overrides.
//
// A *permission* is a fine-grained capability (e.g. "clients.clinical.view").
// Each *role* has a default set. Individual staff can be granted or revoked
// specific permissions on top of their role, so access is fully customisable
// per user without inventing new roles.
//
// Pure data + helpers — safe to import on client and server.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = 'OWNER' | 'ADMIN' | 'PRACTITIONER' | 'FRONT_DESK' | 'STAFF';

export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'OWNER', label: 'Owner', description: 'Unrestricted access, including staff & access control.' },
  { value: 'ADMIN', label: 'Administrator', description: 'Full clinic operations and clinical records.' },
  { value: 'PRACTITIONER', label: 'Practitioner / Doctor', description: 'Clinical access — clients, bookings, health records.' },
  { value: 'FRONT_DESK', label: 'Front desk', description: 'Scheduling and client contact; no clinical health data.' },
  { value: 'STAFF', label: 'General staff', description: 'Limited read access to day-to-day operations.' },
];

export type Permission = {
  key: string;
  group: string;
  label: string;
  description: string;
  /** Clinical/sensitive — surfaced with a warning in the UI. */
  sensitive?: boolean;
};

// The full catalogue, grouped for the management UI.
export const PERMISSIONS: Permission[] = [
  // Dashboard
  { key: 'dashboard.view', group: 'Dashboard', label: 'View dashboard', description: 'See the CRM overview and KPIs.' },

  // Bookings
  { key: 'bookings.view', group: 'Bookings', label: 'View bookings', description: 'See the appointment calendar and booking list.' },
  { key: 'bookings.manage', group: 'Bookings', label: 'Manage bookings', description: 'Reschedule, cancel and edit appointments.' },
  { key: 'bookings.charge', group: 'Bookings', label: 'Take payments', description: 'Charge cards for treatments and fees.', sensitive: true },

  // Consultations
  { key: 'consultations.view', group: 'Consultations', label: 'View consultations', description: 'See incoming consultation enquiries.' },
  { key: 'consultations.manage', group: 'Consultations', label: 'Manage consultations', description: 'Update status, assign and respond.' },

  // Clients
  { key: 'clients.view', group: 'Clients', label: 'View clients', description: 'Browse client records and contact details.' },
  { key: 'clients.edit', group: 'Clients', label: 'Edit clients', description: 'Update client details, notes and tags.' },
  { key: 'clients.clinical.view', group: 'Clients', label: 'View clinical records', description: 'Decrypt and read health assessments.', sensitive: true },
  { key: 'clients.export', group: 'Clients', label: 'Export client data', description: 'Download client lists (GDPR-sensitive).', sensitive: true },

  // Discounts
  { key: 'discounts.manage', group: 'Discounts', label: 'Manage discounts', description: 'Revoke or override welcome-offer claims.' },

  // Marketing
  { key: 'campaigns.view', group: 'Marketing', label: 'View campaigns', description: 'See email campaigns and history.' },
  { key: 'campaigns.send', group: 'Marketing', label: 'Send campaigns', description: 'Create and send marketing emails.' },
  { key: 'automations.view', group: 'Marketing', label: 'View automations', description: 'See automated email flows.' },
  { key: 'automations.manage', group: 'Marketing', label: 'Manage automations', description: 'Configure birthday/follow-up automations.' },

  // Administration
  { key: 'staff.view', group: 'Administration', label: 'View staff', description: 'See the staff & access-control area.' },
  { key: 'staff.manage', group: 'Administration', label: 'Manage staff & access', description: 'Create staff, set roles and customise permissions.', sensitive: true },
  { key: 'settings.manage', group: 'Administration', label: 'Manage settings', description: 'Edit clinic settings and configuration.', sensitive: true },

  // Scheduling
  { key: 'calendar.view', group: 'Scheduling', label: 'View calendar', description: 'See the clinic calendar and appointments.' },
  { key: 'schedule.manage', group: 'Scheduling', label: 'Manage schedules & time-off', description: 'Edit staff working hours, time-off and availability.' },
  { key: 'sop.manage', group: 'Scheduling', label: 'Manage SOPs', description: 'Edit standard operating procedures per treatment.', sensitive: true },

  // Inventory
  { key: 'inventory.view', group: 'Inventory', label: 'View inventory', description: 'See stock levels, batches and expiry dates.' },
  { key: 'inventory.manage', group: 'Inventory', label: 'Manage inventory', description: 'Add items, receive stock and record usage/wastage.' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// Default permission set per role.
const ALL = PERMISSION_KEYS;
const ROLE_DEFAULTS: Record<Role, string[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((k) => k !== 'staff.manage' && k !== 'settings.manage').concat(['staff.view']),
  PRACTITIONER: [
    'dashboard.view',
    'bookings.view',
    'bookings.manage',
    'consultations.view',
    'consultations.manage',
    'clients.view',
    'clients.edit',
    'clients.clinical.view',
    'calendar.view',
    'inventory.view',
    'inventory.manage',
  ],
  FRONT_DESK: [
    'dashboard.view',
    'bookings.view',
    'bookings.manage',
    'bookings.charge',
    'consultations.view',
    'consultations.manage',
    'clients.view',
    'clients.edit',
    'discounts.manage',
    'calendar.view',
    'schedule.manage',
    'inventory.view',
    'inventory.manage',
  ],
  STAFF: ['dashboard.view', 'bookings.view', 'consultations.view', 'clients.view', 'calendar.view', 'inventory.view'],
};

export function roleDefaults(role: string): string[] {
  return ROLE_DEFAULTS[(role as Role)] ?? ROLE_DEFAULTS.STAFF;
}

/** The effective permission set for a user: role defaults + grants − revokes.
 *  OWNER always has everything (cannot be locked out). */
export function effectivePermissions(user: { role: string; permGrant?: string[]; permRevoke?: string[] }): Set<string> {
  if (user.role === 'OWNER') return new Set(ALL);
  const set = new Set(roleDefaults(user.role));
  for (const g of user.permGrant ?? []) set.add(g);
  for (const r of user.permRevoke ?? []) set.delete(r);
  return set;
}

export function hasPermission(
  user: { role: string; permGrant?: string[]; permRevoke?: string[] } | null | undefined,
  key: string,
): boolean {
  if (!user) return false;
  if (user.role === 'OWNER') return true;
  return effectivePermissions(user).has(key);
}

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));
