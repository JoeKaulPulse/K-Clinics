import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';
import { ACCREDITATION_LABELS, formatFee } from '@/lib/academy';
import { site } from '@/lib/site';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'K Academy — Accredited Aesthetics Training in London | KClinics',
  description:
    'Train as an aesthetics practitioner at K Academy, Islington. Ofqual-regulated, VTCT and CPD-accredited courses from Level 2 to Level 7 — blended Thinkific theory, hands-on practical days and in-house exams. Finance available with Clearpay.',
  path: '/academy',
  keywords: ['aesthetics training London', 'Level 4 aesthetics course', 'VTCT aesthetics qualification', 'botox filler training', 'accredited aesthetics academy'],
});

export const dynamic = 'force-dynamic';

const PILLARS = [
  { t: 'Regulated & recognised', d: 'Ofqual-regulated qualifications equivalent to college awards — plus VTCT certification and CPD accreditation employers trust.' },
  { t: 'Blended, flexible delivery', d: 'Theory online via our Thinkific platform, then hands-on practical days in a working clinic, with your exam administered in-house.' },
  { t: 'Train where it’s practised', d: 'Learn inside a live Islington clinic on the same equipment you’ll use in practice — small cohorts, expert clinician-led.' },
];

export default async function AcademyPage() {
  const { listCourses } = await import('@/lib/academy');
  const courses = await listCourses();

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }])} />
      <PageHero
        eyebrow="K Academy"
        title="Train to the standard you’d want to be treated by."
        lede="Accredited aesthetics training in the heart of Islington — Ofqual-regulated, VTCT and CPD-accredited, from foundation through to advanced Level 7. Build a career, not just a certificate."
        gradient={['#2a2420', '#7b6a5d']}
      >
        <div className="flex flex-wrap gap-3">
          <Button href="#courses" variant="gold">Explore courses <ArrowIcon /></Button>
          <Button href="/academy/portal" variant="outline">Trainee login</Button>
        </div>
      </PageHero>

      {/* Accreditation badges */}
      <section className="container-lux pt-12">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm uppercase tracking-[0.16em] text-[var(--color-stone)]">
          {Object.values(ACCREDITATION_LABELS).map((l) => (
            <span key={l} className="flex items-center gap-2"><span className="text-[var(--color-gold)]">✦</span>{l}</span>
          ))}
          <span className="flex items-center gap-2"><span className="text-[var(--color-gold)]">✦</span>Levels 2–7</span>
        </div>
      </section>

      {/* Pillars */}
      <section className="container-lux section">
        <div className="grid gap-8 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.t} delay={i * 0.08}>
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-xl">{p.t}</h3>
                <p className="mt-2 text-[var(--color-ink-soft)]">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Courses */}
      <section id="courses" className="container-lux section">
        <Reveal>
          <p className="eyebrow mb-3">Courses</p>
          <h2 className="text-title">Qualifications that open doors.</h2>
          <p className="mt-3 max-w-2xl text-[var(--color-ink-soft)]">Pay in instalments with Clearpay. Enrol any time — we’ll place you in the next suitable cohort.</p>
        </Reveal>
        {courses.length === 0 ? (
          <p className="mt-8 text-[var(--color-stone)]">Our course schedule is being finalised — <Link href="/academy/portal" className="link-underline">register your interest</Link> and we’ll be in touch.</p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Reveal key={c.id}>
                <Link href={`/academy/${c.slug}`} className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 transition-colors hover:border-[var(--color-gold)]">
                  {c.level && <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold)]">{c.level}</span>}
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl leading-tight">{c.title}</h3>
                  {c.summary && <p className="mt-2 flex-1 text-sm text-[var(--color-ink-soft)]">{c.summary}</p>}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--color-ink)]">{formatFee(c.pricePence)}</span>
                    <span className="text-sm text-[var(--color-gold)] group-hover:underline">View course →</span>
                  </div>
                  {c.accreditations.length > 0 && <p className="mt-2 text-[0.7rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{c.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(' · ')}</p>}
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* Equipment leasing */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-ink)] p-10 text-[var(--color-porcelain)] md:p-14">
            <p className="eyebrow mb-3 text-[var(--color-gold-soft)]">After you qualify</p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl">Launch your practice — equipment leasing for graduates.</h2>
            <p className="mt-4 max-w-2xl text-[var(--color-porcelain)]/80">Qualifying with K Academy is the beginning. Eligible graduates can lease clinic-grade laser and aesthetic devices on flexible terms, so you can start treating clients without the upfront capital.</p>
            <div className="mt-6"><Button href="/academy/portal" variant="gold">Ask about leasing <ArrowIcon /></Button></div>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="container-lux section text-center">
        <Reveal>
          <h2 className="text-title">Ready to begin?</h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--color-ink-soft)]">Choose a course to apply, or talk to our team. Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.</p>
          <div className="mt-6 flex justify-center"><Button href="#courses" variant="gold">Browse courses <ArrowIcon /></Button></div>
        </Reveal>
      </section>
    </>
  );
}
