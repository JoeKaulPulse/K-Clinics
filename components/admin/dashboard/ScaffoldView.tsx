import { VIEWS, type DashboardView } from '@/lib/dashboard-views';
import { DashWidget, EmptyWidget } from './Widgets';

// PRJ-63.3 — placeholder bundle for views whose content lands in later items
// (Clinician 63.4, Reception 63.5, Developer 63.6, Contractor 63.7…). It previews
// the *planned* widgets so an OWNER/ADMIN switching views sees what's coming
// rather than a blank page. Each real view replaces this entry in its own item.
//
// Only reachable by roles that can switch views (OWNER/ADMIN) previewing a
// not-yet-built view — real role users fall back to the Admin overview until
// their dedicated view ships, so nothing regresses.

// Planned widgets per view, sourced from docs/projects/role-based-views.md §3.
const VIEW_PLAN: Record<Exclude<DashboardView, 'admin'>, string[]> = {
  clinician: [
    'Today’s appointments (own first, then clinic)',
    'Room availability board',
    'Room prep status for next clients',
    'Client info quick-cards (clinical-gated)',
    'Appointment-flow entry (guided session)',
  ],
  reception: [
    'Arrivals timeline + one-tap check-in',
    'Prepare-for-arrival handoff (drinks, room)',
    'Payments due / cards to capture',
    'Daily takings snapshot',
    'Calls & chat needing a reply',
  ],
  developer: [
    'Build-board snapshot (open / in-review / blocked)',
    'Recent deployments (state + inspector/logs)',
    'Error reports, newest first',
    'Quick links (GitHub, runtime logs, status)',
  ],
  contractor: [
    'Contracted tasks / work to complete',
    'Time tracking (clock in/out, breaks)',
    'Facility knowledge (plans, where-to-find-things)',
  ],
};

export function ScaffoldView({ view }: { view: DashboardView }) {
  const meta = VIEWS.find((v) => v.id === view);
  const plan = view === 'admin' ? [] : VIEW_PLAN[view] ?? [];

  return (
    <div className="mt-6 space-y-4">
      <DashWidget eyebrow="Preview" title={`${meta?.label ?? 'This'} view is being built`}>
        <p className="text-sm text-[var(--color-stone)]">
          {meta?.blurb} This is a preview of the widgets planned for this view — they go live as
          each part of the role-based dashboards project ships.
        </p>
      </DashWidget>

      <div className="grid gap-4 sm:grid-cols-2">
        {plan.map((label) => (
          <EmptyWidget key={label} title={label} tone="soon" />
        ))}
      </div>
    </div>
  );
}
