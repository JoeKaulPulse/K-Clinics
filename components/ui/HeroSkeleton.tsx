// Shared instant-navigation skeleton for the dark PageHero band used across the
// marketing site (see components/ui/PageHero.tsx). Rendered by route
// loading.tsx files while the real (often DB-backed) page streams in, so a
// visit never blocks on a blank tab for the full server round trip (PRJ-1034.8).
export function HeroSkeleton({ withForm = false }: { withForm?: boolean }) {
  return (
    <section className="relative overflow-hidden bg-[var(--color-ink)]">
      <div className="container-lux relative z-10 pb-[clamp(4rem,3rem+5vw,8rem)] pt-[calc(var(--header-h,5.25rem)+clamp(4rem,3rem+5vw,8rem))]">
        <div className="h-3 w-28 animate-pulse rounded-full bg-white/15" />
        <div className="mt-6 h-10 w-2/3 max-w-xl animate-pulse rounded bg-white/15 sm:h-12" />
        <div className="mt-4 h-4 w-1/2 max-w-md animate-pulse rounded bg-white/10" />
        {withForm && <div className="mx-auto mt-6 h-12 w-full max-w-xl animate-pulse rounded-full bg-white/10" />}
      </div>
    </section>
  );
}
