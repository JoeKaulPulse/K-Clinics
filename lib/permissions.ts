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

export type Role = 'OWNER' | 'ADMIN' | 'PRACTITIONER' | 'FRONT_DESK' | 'DEVELOPER' | 'CONTRACTOR' | 'STAFF';

export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'OWNER', label: 'Owner', description: 'Unrestricted access, including staff & access control.' },
  { value: 'ADMIN', label: 'Administrator', description: 'Full clinic operations and clinical records.' },
  { value: 'PRACTITIONER', label: 'Practitioner / Doctor', description: 'Clinical access — clients, bookings, health records.' },
  { value: 'FRONT_DESK', label: 'Front desk', description: 'Scheduling and client contact; no clinical health data.' },
  { value: 'DEVELOPER', label: 'Developer', description: 'Build board, deploys and platform status only — no client or clinical data.' },
  { value: 'CONTRACTOR', label: 'Contractor', description: 'Contracted tasks, time tracking and facility docs only — no client data.' },
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
  { key: 'clients.delete', group: 'Clients', label: 'Delete clients', description: 'Permanently delete a client and all their data. Irreversible.', sensitive: true },

  // Discounts
  { key: 'discounts.manage', group: 'Discounts', label: 'Manage discounts', description: 'Revoke or override welcome-offer claims.' },

  // Reviews
  { key: 'reviews.manage', group: 'Reviews', label: 'Manage reviews', description: 'Moderate, approve and publish client reviews.' },

  // Rewards / gamification
  { key: 'rewards.view', group: 'Rewards', label: 'View rewards', description: 'See the staff points leaderboard.' },
  { key: 'rewards.manage', group: 'Rewards', label: 'Manage rewards', description: 'Award or deduct staff points and run incentives.', sensitive: true },

  // Marketing
  { key: 'campaigns.view', group: 'Marketing', label: 'View campaigns', description: 'See email campaigns and history.' },
  { key: 'campaigns.send', group: 'Marketing', label: 'Send campaigns', description: 'Create and send marketing emails.' },
  { key: 'automations.view', group: 'Marketing', label: 'View automations', description: 'See automated email flows.' },
  { key: 'automations.manage', group: 'Marketing', label: 'Manage automations', description: 'Configure birthday/follow-up automations.' },

  // Administration
  { key: 'staff.view', group: 'Administration', label: 'View staff', description: 'See the staff & access-control area.' },
  { key: 'staff.manage', group: 'Administration', label: 'Manage staff & access', description: 'Create staff, set roles and customise permissions.', sensitive: true },
  { key: 'settings.manage', group: 'Administration', label: 'Manage settings', description: 'Edit clinic settings and configuration.', sensitive: true },
  { key: 'content.publish', group: 'Administration', label: 'Publish website content', description: 'Make page-builder changes live. Without this, an editor can draft but not publish.', sensitive: true },
  { key: 'security.manage', group: 'Administration', label: 'Security centre', description: 'View threats, manage lockouts, 2FA policy and key rotation.', sensitive: true },

  // Scheduling
  { key: 'calendar.view', group: 'Scheduling', label: 'View calendar', description: 'See the clinic calendar and appointments.' },
  { key: 'schedule.manage', group: 'Scheduling', label: 'Manage schedules & time-off', description: 'Edit staff working hours, time-off and availability.' },
  { key: 'sop.manage', group: 'Scheduling', label: 'Manage SOPs', description: 'Edit standard operating procedures per treatment.', sensitive: true },
  { key: 'rooms.prep.manage', group: 'Scheduling', label: 'Set room readiness', description: 'Mark treatment rooms dirty / cleaning / ready and see room availability.' },
  { key: 'tasks.automate', group: 'Scheduling', label: 'Manage task automations', description: 'Create recurring/triggered work and repeat events that auto-assign tasks to staff.' },

  // Inventory
  { key: 'inventory.view', group: 'Inventory', label: 'View inventory', description: 'See stock levels, batches and expiry dates.' },
  { key: 'inventory.manage', group: 'Inventory', label: 'Manage inventory', description: 'Add items, receive stock and record usage/wastage.' },

  // Day close
  { key: 'dayclose.run', group: 'Day close', label: 'Run day-close', description: 'Complete the end-of-day shutdown: cash-up, stock take and closedown checklist.' },
  { key: 'dayclose.manage', group: 'Day close', label: 'Configure & report on day-close', description: 'Edit closedown tasks & reminders and view close-out reports.', sensitive: true },

  // Build & issues
  { key: 'build.view', group: 'Build & issues', label: 'Use the build board', description: 'Report problems with screenshots and see the build & issues board.' },
  { key: 'build.manage', group: 'Build & issues', label: 'Manage the build board', description: 'Triage, set status & urgency, assign, and push items to GitHub.', sensitive: true },

  // Finance
  { key: 'finance.view', group: 'Finance', label: 'View finances', description: 'See cashflow forecasts and cash reserves.', sensitive: true },
  { key: 'finance.manage', group: 'Finance', label: 'Manage finances', description: 'Edit forecast lines, reserves and ring-fenced funds.', sensitive: true },

  // Telephony
  { key: 'calls.view', group: 'Telephony', label: 'View calls', description: 'See the call log, recordings and transcripts.' },
  { key: 'calls.manage', group: 'Telephony', label: 'Place & annotate calls', description: 'Use click-to-dial and add notes to call records.' },

  // Suppliers
  { key: 'suppliers.view', group: 'Suppliers', label: 'View suppliers', description: 'See supplier contacts, account details and their Xero bills.' },
  { key: 'suppliers.manage', group: 'Suppliers', label: 'Manage suppliers', description: 'Add, edit and link suppliers (incl. Xero contacts).' },

  // Point of sale
  { key: 'pos.use', group: 'Point of sale', label: 'Use the till (POS)', description: 'Take in-store product payments and record over-the-counter sales.' },

  // Platform
  { key: 'platform.status', group: 'Administration', label: 'View platform status', description: 'See the Owner/Admin status & health audit page and schedule maintenance windows.', sensitive: true },

  // Facility (PRJ-63)
  { key: 'facility.view', group: 'Facility', label: 'View facility info', description: 'See floor/electrical/plumbing plans, equipment locations and where-to-find-things guides.' },
  { key: 'facility.manage', group: 'Facility', label: 'Manage facility info', description: 'Upload and organise facility plans, equipment guides and instructions.' },

  // Contractor tasks (PRJ-63)
  { key: 'contractor.tasks.view', group: 'Facility', label: 'View contracted tasks', description: 'See contracted work assigned to you (maintenance, fit-out, jobs).' },
  { key: 'contractor.tasks.manage', group: 'Facility', label: 'Assign contracted tasks', description: 'Create, assign and track contractor tasks.' },

  // Time tracking (BLD-285 / PRJ-63.6)
  { key: 'timetracking.use', group: 'Facility', label: 'Clock in / out', description: 'Clock in and out of shifts and log breaks.' },
  { key: 'timetracking.manage', group: 'Facility', label: 'Manage timesheets', description: 'View and edit all staff shift records and timesheets.' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// Default permission set per role.
const ALL = PERMISSION_KEYS;
const ROLE_DEFAULTS: Record<Role, string[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((k) => k !== 'staff.manage' && k !== 'settings.manage' && k !== 'security.manage').concat(['staff.view']),
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
    'rooms.prep.manage',
    'inventory.view',
    'inventory.manage',
    'rewards.view',
    'calls.view',
    'dayclose.run',
    'build.view',
    'facility.view',
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
    'reviews.manage',
    'calendar.view',
    'schedule.manage',
    'tasks.automate',
    'rooms.prep.manage',
    'inventory.view',
    'inventory.manage',
    'rewards.view',
    'calls.view',
    'calls.manage',
    'suppliers.view',
    'suppliers.manage',
    'pos.use',
    'dayclose.run',
    'build.view',
    'facility.view',
  ],
  // PRJ-63: build/platform only — deliberately no client or clinical access.
  DEVELOPER: ['dashboard.view', 'build.view', 'platform.status'],
  // BLD-285: timetracking.use added (PRJ-63.6). Contractor may clock in/out.
  CONTRACTOR: ['dashboard.view', 'facility.view', 'contractor.tasks.view', 'timetracking.use'],
  STAFF: ['dashboard.view', 'bookings.view', 'consultations.view', 'clients.view', 'calendar.view', 'inventory.view', 'dayclose.run', 'build.view', 'facility.view', 'timetracking.use'],
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
