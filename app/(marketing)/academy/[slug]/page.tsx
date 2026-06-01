import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { ApplyForm } from '@/components/academy/ApplyForm';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';
import { ACCREDITATION_LABELS, formatFee } from '@/lib/academy';

export const dynamic = 'force-dynamic';

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

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { getCourse } = await import('@/lib/academy');
  const course = await getCourse(slug);
  if (!course) notFound();

  const cohortOptions = course.cohorts.map((h) => ({ id: h.id, label: `${fmt(h.startAt.toISOString())}${h.remaining <= 3 ? ` · ${h.remaining} places left` : ''}` }));

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }, { name: course.title, path: `/academy/${slug}` }])} />
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
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="space-y-6 lg:sticky lg:top-28">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">Course fee</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">{formatFee(course.pricePence)}</p>
              {course.pricePence > 0 && <p className="mt-2 text-sm text-[var(--color-stone)]">Spread the cost with <strong className="text-[var(--color-ink)]">Clearpay</strong> — ask us about instalment options. No payment is taken until your place is confirmed.</p>}
            </div>
            <ApplyForm courseId={course.id} courseTitle={course.title} cohorts={cohortOptions} />
            <p className="text-center text-sm text-[var(--color-stone)]">Already training with us? <Link href="/academy/portal" className="link-underline font-medium text-[var(--color-ink)]">Trainee login</Link></p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
