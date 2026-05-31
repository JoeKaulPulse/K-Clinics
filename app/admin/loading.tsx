// Instant navigation feedback for the CRM. Rendered immediately on every
// /admin navigation while the dynamic page streams in, so tab switches feel
// instant instead of blocking on the server render.
export default function AdminLoading() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="hidden shrink-0 flex-col gap-2 border-r border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 lg:flex lg:w-64">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="h-9 w-6 animate-pulse rounded bg-[var(--color-bone)]" />
          <div className="h-2 w-24 animate-pulse rounded bg-[var(--color-bone)]" />
          <div className="h-2 w-16 animate-pulse rounded bg-[var(--color-bone)]" />
        </div>
        <div className="mb-3 h-9 w-full animate-pulse rounded bg-[var(--color-bone)]" />
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded bg-[var(--color-bone)]" style={{ opacity: 1 - i * 0.07 }} />
        ))}
      </aside>
      <main className="flex-1 p-5 md:p-8 lg:p-10">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--color-bone)]" />
        <div className="mt-3 h-3 w-72 animate-pulse rounded bg-[var(--color-bone)]" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bone)]" />
          ))}
        </div>
        <div className="mt-6 h-64 w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bone)]" />
      </main>
    </div>
  );
}
