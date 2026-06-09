import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ReviewActions } from '@/components/admin/ReviewActions';
import { GoogleReviewsPanel } from '@/components/admin/GoogleReviewsPanel';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  PUBLISHED: 'bg-[var(--color-ink)] text-[var(--color-porcelain)]',
  HIDDEN: 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]',
};
const Stars = ({ n }: { n: number | null }) => (
  <span className="text-[var(--color-gold)]">{n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—'}</span>
);

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'reviews.manage')) redirect('/admin');
  const { status = 'SUBMITTED' } = await searchParams;

  const { db } = await import('@/lib/db');
  const where = ['PENDING', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'HIDDEN'].includes(status) ? { status: status as never } : {};
  const [reviews, counts, agg] = await Promise.all([
    db.review.findMany({
      where, orderBy: { updatedAt: 'desc' }, take: 200,
      include: { client: { select: { id: true, firstName: true, lastName: true } }, clinician: { select: { name: true } } },
    }),
    db.review.groupBy({ by: ['status'], _count: true }),
    db.review.aggregate({ _avg: { rating: true }, _count: { rating: true }, where: { rating: { not: null }, status: { in: ['APPROVED', 'PUBLISHED'] } } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  // Google Business Profile reviews (imported via the My Business API).
  const { googleBusinessConfigured, googleBusinessConnected, businessRedirectUri } = await import('@/lib/google-business');
  const [gReviews, gConnected] = await Promise.all([
    db.googleReview.findMany({ orderBy: [{ createTime: 'desc' }], take: 200 }),
    googleBusinessConnected(),
  ]);
  const gRedirectUri = businessRedirectUri();
  const googleReviews = gReviews.map((r) => ({
    id: r.id, googleName: r.googleName, reviewerName: r.reviewerName, starRating: r.starRating,
    comment: r.comment, createTime: r.createTime?.toISOString() ?? null, replyComment: r.replyComment,
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const FILTERS = ['SUBMITTED', 'APPROVED', 'PUBLISHED', 'PENDING', 'HIDDEN', 'ALL'];

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{L('Reviews', 'Відгуки')}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {L('Moderate client reviews and publish the best. Requests are sent automatically after each treatment. Note: the website only shows 5★ reviews with a written comment, and a client’s name only when they’ve consented.', 'Модеруйте відгуки клієнтів і публікуйте найкращі. Запити надсилаються автоматично після кожної процедури. Примітка: на сайті показуються лише відгуки на 5★ із текстом, а ім’я клієнта — лише за згодою.')}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: L('Average rating', 'Середній бал'), value: agg._avg.rating ? `${agg._avg.rating.toFixed(1)}★` : '—', tone: 'text-[var(--color-gold)]' },
          { label: L('Total reviews', 'Усього відгуків'), value: String(agg._count.rating) },
          { label: L('Awaiting moderation', 'Очікують модерації'), value: countOf('SUBMITTED'), tone: countOf('SUBMITTED') ? 'text-amber-700' : '' },
          { label: L('Published', 'Опубліковано'), value: countOf('PUBLISHED') },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <div className={`font-[family-name:var(--font-display)] text-2xl ${s.tone || ''}`}>{s.value}</div>
            <div className="mt-1 text-xs text-[var(--color-stone)]">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-1 rounded-full border border-[var(--color-line)] p-0.5 text-sm">
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/reviews?status=${f}`} className={`rounded-full px-3 py-1 ${status === f ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)]'}`}>
            {f === 'ALL' ? L('All', 'Усі') : f[0] + f.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {reviews.length === 0 && <p className="text-sm text-[var(--color-stone)]">{L('No reviews here yet.', 'Поки що немає відгуків.')}</p>}
        {reviews.map((r) => {
          const name = [r.client.firstName, r.client.lastName].filter(Boolean).join(' ') || L('Client', 'Клієнт');
          return (
            <div key={r.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars n={r.rating} />
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${STATUS_STYLE[r.status]}`}>{r.status.toLowerCase()}</span>
                    {r.displayConsent
                      ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-green-800">{L('name consented', 'згода на ім’я')}</span>
                      : <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-[var(--color-stone)]">{L('name hidden publicly', 'ім’я приховано')}</span>}
                    {r.treatmentTitle && <span className="text-xs text-[var(--color-stone-soft)]">{r.treatmentTitle}</span>}
                  </div>
                  {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                  {r.body && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{r.body}</p>}
                  <p className="mt-2 text-xs text-[var(--color-stone-soft)]">
                    <Link href={`/admin/clients/${r.client.id}`} className="hover:text-[var(--color-gold)]">{name}</Link>
                    {r.clinician?.name ? ` · ${r.clinician.name}` : ''}
                    {r.submittedAt ? ` · ${r.submittedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  </p>
                </div>
                <ReviewActions id={r.id} status={r.status} />
              </div>
            </div>
          );
        })}
      </div>

      <GoogleReviewsPanel connected={gConnected} configured={googleBusinessConfigured()} reviews={googleReviews} redirectUri={gRedirectUri} />
    </AdminShell>
  );
}
