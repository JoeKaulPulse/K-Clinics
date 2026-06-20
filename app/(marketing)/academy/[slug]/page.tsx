import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { ApplyForm } from '@/components/academy/ApplyForm';
import { Stars } from '@/components/ui/Stars';
import { pageMeta, JsonLd, breadcrumbLd, courseLd } from '@/lib/seo';
import { ACCREDITATION_LABELS, formatFee } from '@/lib/academy';
import { getActivePromo } from '@/lib/academy-utils';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { getCourse } = await import('@/lib/academy');
  const c = await getCourse(slug).catch(() => null);
  if (!c) return pageMeta({ title: 'Course — K Academy', description: 'Accredited aesthetics training at K Academy.', path: `/academy/${slug}` });
  return pageMeta({
    title: `${c.title}${c.level ? ` (${c.level})` : ''} — K Academy`,
    description: c.summary || `Accredited aesthetics training: ${c.title} at K Academy, Islington.`,
    path: `/academy/${slug}`,
  });
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { getCourse } = await import('@/lib/academy');
  const course = await getCourse(slug);
  if (!course) notFound();

  const { getPublishedReviews, getPreviewLessons } = await import('@/lib/lms');
  const [rating, previews] = await Promise.all([getPublishedReviews(course.id), getPreviewLessons(course.id)]);

  const cohortOptions = course.cohorts.map((h) => ({ id: h.id, label: `${fmt(h.startAt.toISOString())}${h.remaining <= 3 ? ` · ${h.remaining} places left` : ''}` }));
  const activePromo = getActivePromo(course);

  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }, { name: course.title, path: `/academy/${slug}` }]),
        courseLd({ title: course.title, description: course.summary || course.description || course.title, path: `/academy/${slug}`, pricePence: course.pricePence, durationText: course.durationText }),
      ]} />
      <PageHero
        eyebrow={course.level ? `K Academy · ${course.level}` : 'K Academy'}
        title={course.title}
        lede={course.summary || 'Accredited, clinic-based aesthetics training.'}
        gradient={['#2a2420', '#7b6a5d']}
      />

      <section className="container-lux section grid gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
        <Reveal>
          <div className="space-y-8">
            {course.accreditations.length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm uppercase tracking-[0.14em] text-[var(--color-stone)]">
                {course.accreditations.map((a) => <span key={a} className="flex items-center gap-2"><span className="text-[var(--color-gold)]">✦</span>{ACCREDITATION_LABELS[a] ?? a}</span>)}
              </div>
            )}

            {rating.count > 0 && (
              <a href="#reviews" className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                <Stars rating={rating.average} />
                <span className="font-medium">{rating.average.toFixed(1)}</span>
                <span className="text-[var(--color-stone)]">· {rating.count} trainee review{rating.count === 1 ? '' : 's'}</span>
              </a>
            )}

            {course.description && <div className="prose-lux whitespace-pre-line text-[var(--color-ink-soft)]">{course.description}</div>}

            {course.outcomes.length > 0 && (
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl">What you’ll learn</h2>
                <ul className="mt-4 space-y-2">
                  {course.outcomes.map((o) => (
                    <li key={o} className="flex items-start gap-3 text-[var(--color-ink-soft)]">
                      <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]"><svg viewBox="0 0 20 20" className="h-3 w-3" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 sm:grid-cols-2">
              {course.format && <div><dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Format</dt><dd className="mt-1 text-[var(--color-ink)]">{course.format}</dd></div>}
              {course.durationText && <div><dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Duration</dt><dd className="mt-1 text-[var(--color-ink)]">{course.durationText}</dd></div>}
              {course.prerequisites && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Prerequisites</dt><dd className="mt-1 text-[var(--color-ink)]">{course.prerequisites}</dd></div>}
            </dl>

            {course.cohorts.length > 0 && (
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl">Upcoming practical dates</h2>
                <ul className="mt-4 space-y-2">
                  {course.cohorts.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] px-4 py-3 text-sm">
                      <span className="font-medium text-[var(--color-ink)]">{fmt(h.startAt.toISOString())}{h.endAt ? ` – ${fmt(h.endAt.toISOString())}` : ''}</span>
                      <span className="text-[var(--color-stone)]">{h.location ?? 'Islington'}{h.trainer ? ` · ${h.trainer}` : ''} · {h.remaining > 0 ? `${h.remaining} place${h.remaining === 1 ? '' : 's'} left` : 'Full'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previews.length > 0 && (
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl">Try a free taster</h2>
                <p className="mt-1 text-sm text-[var(--color-stone)]">Sample a lesson before you apply — no sign-up needed.</p>
                <ul className="mt-4 space-y-2">
                  {previews.map((p) => (
                    <li key={p.id}>
                      <Link href={`/academy/${slug}/taster/${p.id}`} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bone)] px-4 py-3 text-sm transition-colors hover:border-[var(--color-gold)]">
                        <span className="text-[var(--color-gold)]">▶</span>
                        <span className="font-medium text-[var(--color-ink)]">{p.title}</span>
                        <span className="text-[var(--color-stone)]">· {p.moduleTitle}{p.durationMin ? ` · ${p.durationMin} min` : ''}</span>
                        <span className="ml-auto text-xs font-medium text-[var(--color-gold)]">Free →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rating.count > 0 && (
              <div id="reviews" className="scroll-mt-28">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="font-[family-name:var(--font-display)] text-2xl">Trainee reviews</h2>
                  <span className="flex items-center gap-2 text-sm text-[var(--color-stone)]"><Stars rating={rating.average} /> {rating.average.toFixed(1)} out of 5 · {rating.count} review{rating.count === 1 ? '' : 's'}</span>
                </div>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {rating.reviews.map((r) => (
                    <li key={r.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
                      <div className="flex items-center justify-between gap-2">
                        <Stars rating={r.rating} />
                        <span className="text-xs text-[var(--color-stone)]">{fmtShort(r.createdAt)}</span>
                      </div>
                      {r.title && <p className="mt-2 font-medium text-[var(--color-ink)]">{r.title}</p>}
                      {r.body && <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-ink-soft)]">{r.body}</p>}
                      <p className="mt-3 text-xs text-[var(--color-stone)]">— {r.authorName}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="space-y-6 lg:sticky lg:top-28">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Course fee</p>
              {activePromo ? (
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <span className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-gold-deep)]">{formatFee(activePromo)}</span>
                  <span className="text-lg text-[var(--color-stone)] line-through">{formatFee(course.pricePence)}</span>
                  <span className="rounded-full bg-[var(--color-gold)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--color-gold-deep)]">Special offer</span>
                </div>
              ) : (
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">{formatFee(course.pricePence)}</p>
              )}
              {course.pricePence > 0 && <p className="mt-2 text-sm text-[var(--color-stone)]">Spread the cost monthly, or check if you qualify for <Link href="/academy/funding" className="link-underline font-medium text-[var(--color-ink)]">government or council funding</Link>. No payment is taken until your place is confirmed.</p>}
            </div>
            <ApplyForm courseId={course.id} courseTitle={course.title} cohorts={cohortOptions} />
            <p className="text-center text-sm text-[var(--color-stone)]">Already training with us? <Link href="/academy/portal" className="link-underline font-medium text-[var(--color-ink)]">Trainee login</Link></p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
