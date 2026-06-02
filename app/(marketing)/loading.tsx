// Lightweight branded loading state for marketing route transitions.
export default function Loading() {
  return (
    <div className="grid min-h-[60svh] place-items-center" role="status" aria-label="Loading">
      <span className="relative flex h-10 w-10">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-gold)] opacity-30" />
        <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-line)] font-[family-name:var(--font-display)] text-[var(--color-gold)]">K</span>
      </span>
    </div>
  );
}
