import { HeroSkeleton } from '@/components/ui/HeroSkeleton';

// /search is `force-dynamic` (results depend on the ?q query), so this streams
// an instant, on-brand skeleton instead of a blank tab while it renders (PRJ-1034.8).
export default function SearchLoading() {
  return (
    <>
      <HeroSkeleton withForm />
      <section className="container-lux section">
        <ul className="mx-auto max-w-2xl divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-4 bg-[var(--color-porcelain)] px-6 py-5">
              <span className="min-w-0 flex-1">
                <span className="block h-4 w-2/3 animate-pulse rounded bg-[var(--color-bone)]" />
                <span className="mt-2 block h-3 w-1/3 animate-pulse rounded bg-[var(--color-bone)]" />
              </span>
              <span className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-[var(--color-bone)]" />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
