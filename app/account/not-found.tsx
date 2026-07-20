import Link from 'next/link';

// BLD-745: keep clients inside their portal on a bad /account/... URL instead
// of dropping them into the public marketing 404.
export default function AccountNotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-porcelain)] px-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-stone)]">Your account — page not found</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl">404</h1>
        <p className="mx-auto mt-4 max-w-sm text-sm text-[var(--color-stone)]">
          That page doesn&rsquo;t exist — it may have moved, or the link is out of date.
        </p>
        <div className="mt-7 flex justify-center gap-3 text-sm">
          <Link href="/account" className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-[var(--color-porcelain)]">Back to my account</Link>
          <Link href="/account/appointments" className="rounded-full border border-[var(--color-line)] px-5 py-2.5 hover:border-[var(--color-gold)]">My appointments</Link>
        </div>
      </div>
    </main>
  );
}
