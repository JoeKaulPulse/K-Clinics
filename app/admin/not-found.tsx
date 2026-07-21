import Link from 'next/link';

// BLD-745: a mistyped or stale /admin/... URL used to fall through to the
// public marketing 404 (booking CTA, public nav) with no way back into the
// CRM. Deliberately minimal — no AdminShell, since not-found renders without
// the session/permission context the shell needs.
export default function AdminNotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-porcelain)] px-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-stone)]">Admin — page not found</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl">404</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm text-[var(--color-stone)]">
          This admin page doesn&rsquo;t exist — it may have moved, or the link is stale.
        </p>
        <div className="mt-7 flex justify-center gap-3 text-sm">
          <Link href="/admin" className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-[var(--color-porcelain)]">Back to the dashboard</Link>
          <Link href="/admin/login" className="rounded-full border border-[var(--color-line)] px-5 py-2.5 hover:border-[var(--color-gold)]">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
