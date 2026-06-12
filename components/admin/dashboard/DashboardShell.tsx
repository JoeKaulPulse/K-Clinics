import type { ReactNode } from 'react';
import { canSwitchViews, type DashboardView } from '@/lib/dashboard-views';
import { ViewSwitcher } from '@/components/admin/ViewSwitcher';

// PRJ-63.3 / BLD-226 — view-aware shell. A single header row: the page heading
// on the left, and on the right a compact, right-aligned utility cluster — the
// `aside` controls (e.g. the live clock/weather chip + clock-in pill) followed
// by the OWNER/ADMIN "Viewing as ▾" dropdown. Everything is one wrapping flex so
// it stays tidy and anchored on desktop and folds gracefully (not onto stray
// lines) on mobile, keeping real content as high above the fold as possible.
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
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="min-w-0 flex-1">{heading}</div>
        {(canSwitch || aside) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {aside}
            {canSwitch && <ViewSwitcher active={view} />}
          </div>
        )}
      </div>
      {children}
    </>
  );
}
