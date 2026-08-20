// BLD-1422: a tiny, framework-agnostic label for "how long until this offer/
// announcement ends", shared by OffersStrip (server component) and
// AnnouncementBar ('use client') — deliberately NOT `server-only` so both can
// import it. Both already fetch `endAt` but never rendered it.
//
// Day boundaries are compared by calendar date (not exact elapsed ms) so the
// label reads the same all day rather than flipping as the clock ticks —
// mirrors the inclusive end-of-day window semantics in
// lib/site-config.ts#announcementActive.
export function offerCountdownLabel(endAt: Date | string | null | undefined, now: Date = new Date()): string | null {
  if (!endAt) return null;
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) return null;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(end).getTime() - startOfDay(now).getTime()) / 86_400_000);

  if (diffDays < 0) return null; // already ended — never claim "ends never" or show a stale/negative chip
  if (diffDays === 0) return 'Ends today';
  if (diffDays === 1) return 'Ends tomorrow';
  return `Ends in ${diffDays} days`;
}
