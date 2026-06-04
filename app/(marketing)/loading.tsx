import { KMark } from '@/components/brand/marks';

// Lightweight branded loading state for marketing route transitions — uses the
// real brand K monogram (not a typographic letter) inside the ring.
export default function Loading() {
  return (
    <div className="grid min-h-[60svh] place-items-center" role="status" aria-label="Loading">
      <span className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-gold)] opacity-20" />
        <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)]">
          <span className="block h-5 w-[0.7rem] text-[var(--color-gold-deep)]"><KMark /></span>
        </span>
      </span>
    </div>
  );
}
