import { HeroSkeleton } from '@/components/ui/HeroSkeleton';

// /book is `force-dynamic` and loads the DB-backed treatment catalogue (with
// retries) before it can render, so without this the tab sits blank for the
// full round trip. This streams an instant, on-brand skeleton instead (PRJ-1034.8).
export default function BookLoading() {
  return (
    <>
      <HeroSkeleton />
      <section className="container-lux section grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <div className="h-3 w-24 animate-pulse rounded-full bg-[var(--color-bone)]" />
          <div className="mt-4 h-7 w-3/4 animate-pulse rounded bg-[var(--color-bone)]" />
          <div className="mt-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 w-full animate-pulse rounded bg-[var(--color-bone)]" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        </div>
        <div className="h-[32rem] w-full animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)]" />
      </section>
    </>
  );
}
