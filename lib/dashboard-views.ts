// PRJ-63 — role → dashboard view resolution. Pure data + helpers (client + server
// safe). The view a user lands on is derived from their role; OWNER/ADMIN may
// pin a different view (preferredDashboardView) to preview any role's experience.
// The per-view content/widgets are built in the follow-up items (PRJ-63.3–63.7);
// this module is the single source of truth for which view is active.

import type { Role } from '@/lib/permissions';

export type DashboardView = 'admin' | 'clinician' | 'reception' | 'developer' | 'contractor';

export const VIEWS: { id: DashboardView; label: string; blurb: string }[] = [
  { id: 'admin', label: 'Management', blurb: 'KPIs, revenue and what needs attention.' },
  { id: 'clinician', label: 'Clinician', blurb: 'Appointments, rooms, prep and client info.' },
  { id: 'reception', label: 'Reception', blurb: 'Arrivals, check-in, prep and front-of-house.' },
  { id: 'developer', label: 'Developer', blurb: 'Build board, deploys, errors and logs.' },
  { id: 'contractor', label: 'Contractor', blurb: 'Contracted tasks, time tracking and facility docs.' },
];

const VIEW_IDS = new Set<DashboardView>(VIEWS.map((v) => v.id));
export const isDashboardView = (v: unknown): v is DashboardView => typeof v === 'string' && VIEW_IDS.has(v as DashboardView);

/** The view that belongs to a role by default. */
export const VIEW_FOR_ROLE: Record<Role, DashboardView> = {
  OWNER: 'admin',
  ADMIN: 'admin',
  PRACTITIONER: 'clinician',
  FRONT_DESK: 'reception',
  DEVELOPER: 'developer',
  CONTRACTOR: 'contractor',
  STAFF: 'admin',
};

/** Only owners/admins may preview other roles' views. */
export function canSwitchViews(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/** The active view: a valid pinned preference (switchers only) wins, else the
 *  role default. */
export function resolveView(role: string, preferred?: string | null): DashboardView {
  if (canSwitchViews(role) && isDashboardView(preferred)) return preferred;
  return VIEW_FOR_ROLE[(role as Role)] ?? 'admin';
}
