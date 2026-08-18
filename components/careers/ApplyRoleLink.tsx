'use client';

import Link from 'next/link';

// PRJ-1034.12: each vacancy card's "Apply for this role" link already carries
// ?role=<vacancyId>#apply, which ApplyForm reads on mount to pre-select the
// right role. That covers a fresh page load (a bookmarked or shared link),
// but the vacancy list and ApplyForm live on the same /careers page — so a
// visitor who is already on the page and clicks a *different* vacancy's
// Apply link triggers a same-route, query-only navigation. ApplyForm is
// already mounted at that point, and its mount-only effect won't re-run, so
// the dropdown would silently keep the previously-selected (or first) role.
// This onClick also dispatches a same-page event carrying the vacancy id, so
// an already-mounted ApplyForm updates immediately — the href/hash keeps
// working exactly as before for direct links, new tabs and bookmarks.
export function ApplyRoleLink({ vacancyId, className }: { vacancyId: string; className?: string }) {
  return (
    <Link
      href={`/careers?role=${vacancyId}#apply`}
      onClick={() => window.dispatchEvent(new CustomEvent('kclinics:apply-role', { detail: vacancyId }))}
      className={className}
    >
      Apply for this role →
    </Link>
  );
}
