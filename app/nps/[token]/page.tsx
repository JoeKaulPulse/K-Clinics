import type { Metadata } from 'next';
import { NpsWidget } from '@/components/nps/NpsWidget';
import { getNps } from '@/lib/nps';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your feedback · KClinics', robots: { index: false, follow: false } };

export default async function NpsPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ s?: string }> }) {
  const { token } = await params;
  const { s } = await searchParams;
  const row = await getNps(token).catch(() => null);

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bone)] px-5 py-16">
      {!row ? (
        <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Link expired</h1>
          <p className="mt-2 text-sm text-[var(--color-stone)]">This feedback link is no longer valid. If you’d still like to share something, just reply to our email — thank you.</p>
        </div>
      ) : (
        <NpsWidget token={token} initialScore={s !== undefined && /^\d+$/.test(s) ? Math.min(10, parseInt(s, 10)) : null} />
      )}
    </main>
  );
}
