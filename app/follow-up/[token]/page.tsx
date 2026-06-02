import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FollowUpForm } from '@/components/FollowUpForm';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'How are you getting on? — KClinics', robots: { index: false } };

export default async function FollowUpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { getFollowUp } = await import('@/lib/followup');
  const fu = await getFollowUp(token).catch(() => null);
  if (!fu) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-porcelain)] px-5 py-16">
      <div className="mx-auto max-w-xl">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.3em] text-[var(--color-stone)]">{site.name}</p>
        {fu.respondedAt ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">Thank you</h2>
            <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">We’ve already received your response — thank you. If anything’s changed, just give us a call.</p>
          </div>
        ) : (
          <FollowUpForm token={fu.token} treatment={fu.treatmentTitle} />
        )}
      </div>
    </main>
  );
}
