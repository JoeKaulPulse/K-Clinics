import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { KMark } from '@/components/brand/marks';

export const dynamic = 'force-dynamic';

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!crmEnabled) notFound();

  const { db } = await import('@/lib/db');
  const review = await db.review.findUnique({
    where: { token },
    select: { token: true, status: true, rating: true, treatmentTitle: true, client: { select: { firstName: true } } },
  });
  if (!review) notFound();

  const { googleReviewLink } = await import('@/lib/review-system');
  const googleUrl = await googleReviewLink();
  const done = review.status !== 'PENDING';

  return (
    <main className="min-h-screen bg-[var(--color-porcelain)] text-[var(--color-ink)]">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
        <span className="mb-8 block h-10 w-6 text-[var(--color-ink)]"><KMark /></span>
        {done ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl">Thank you{review.client.firstName ? `, ${review.client.firstName}` : ''}.</h1>
            <p className="mt-3 text-[var(--color-stone)]">Your feedback has been received — we’re grateful you took the time.</p>
            {googleUrl && review.rating != null && review.rating >= 4 && (
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block rounded-full bg-[var(--color-gold-deep)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
                Share it on Google too
              </a>
            )}
          </div>
        ) : (
          <>
            <p className="eyebrow mb-2">Your visit</p>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.9rem,1.4rem+1.6vw,2.6rem)] leading-tight">
              How was your {review.treatmentTitle || 'experience'}{review.client.firstName ? `, ${review.client.firstName}` : ''}?
            </h1>
            <p className="mt-2 text-[var(--color-stone)]">Your feedback helps us keep raising the standard. It only takes a moment.</p>
            <div className="mt-8">
              <ReviewForm token={review.token} googleUrl={googleUrl} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
