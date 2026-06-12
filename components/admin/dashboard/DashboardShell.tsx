import type { ReactNode } from 'react';
import { canSwitchViews, type DashboardView } from '@/lib/dashboard-views';
import { ViewSwitcher } from '@/components/admin/ViewSwitcher';

// PRJ-63.3 — view-aware shell. Wraps a dashboard view with a shared header row:
// the page heading on the left, and on the right a stacked cluster of (for
// OWNER/ADMIN only) the ViewSwitcher and an optional `aside` (e.g. the live
// clock/weather card). The active view's content is passed as children; the
// switcher persists the choice and refreshes, so the server re-resolves which
// view renders. The same shell is used by the Admin overview and by each role
// view as it ships, keeping the chrome consistent.
export function DashboardShell({
  role,
  view,
  heading,
  aside,
  children,
}: {
  role: string;
  view: DashboardView;
  heading: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const canSwitch = canSwitchViews(role);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">{heading}</div>
        {(canSwitch || aside) && (
          <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
            {canSwitch && (
              <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:items-end">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-stone-soft)]">Viewing as</p>
                <ViewSwitcher active={view} />
              </div>
            )}
            {aside}
          </div>
        )}
      </div>
      {children}
    </>
  );
}
