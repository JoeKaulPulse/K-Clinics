import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { AcademyBanner } from '@/components/academy/AcademyBanner';
import { BundleCard } from '@/components/academy/BundleCard';
import { Reveal } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { pageMeta, JsonLd, breadcrumbLd, academyLd, itemListLd, faqLd } from '@/lib/seo';
import { ACCREDITATION_LABELS, formatFee } from '@/lib/academy';
import { getActivePromo } from '@/lib/academy-utils';
import { academyFaqs } from '@/lib/academy-faqs';
import { FUNDING_OUTLOOK } from '@/lib/funding';
import { FaqAccordion } from '@/components/ui/FaqAccordion';
import { site } from '@/lib/site';
import { PhoneLink } from '@/components/marketing/PhoneLink';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'K Academy — Aesthetics Training in London | KClinics',
  description:
    'Train as an aesthetics practitioner at K Academy, Islington. Ofqual-regulated, VTCT and CPD-accredited courses from Level 2 to Level 7, finance available.',
  path: '/academy',
  keywords: ['aesthetics training London', 'Level 4 aesthetics course', 'VTCT aesthetics qualification', 'anti-wrinkle and filler training', 'accredited aesthetics academy'],
});

export const revalidate = 3600;

const PILLARS = [
  { t: 'Regulated & recognised', d: 'Ofqual-regulated qualifications equivalent to college awards — plus VTCT certification and CPD accreditation employers trust.' },
  { t: 'Blended, flexible delivery', d: 'Theory online via our Thinkific platform, then hands-on practical days in a working clinic, with your exam administered in-house.' },
  { t: 'Train where it’s practised', d: 'Learn inside a live Islington clinic on the same equipment you’ll use in practice — small cohorts, expert clinician-led.' },
];

export default async function AcademyPage() {
  const { listCourses, listBundles } = await import('@/lib/academy');
  const [courses, bundles] = await Promise.all([listCourses().catch(() => []), listBundles().catch(() => [])]);

  // Find the lowest active promo price across all courses (for the banner).
  const lowestPromo = courses.reduce<number | null>((best, c) => {
    const p = getActivePromo(c);
    if (p == null) return best;
    return best == null || p < best ? p : best;
  }, null);

  // "At a glance" facts: short, quotable statements for answer engines (GEO).
  // Derived from live data where possible so they never drift from the catalogue.
  const priced = courses.map((c) => getActivePromo(c) ?? c.pricePence).filter((p) => p > 0);
  const lowestFee = priced.length ? Math.min(...priced) : null;
  const AT_A_GLANCE: { label: string; value: string }[] = [
    { label: 'Where', value: `${site.address.street}, ${site.address.locality}, London ${site.address.postalCode}. Practical days inside the working clinic.` },
    { label: 'Regulation', value: 'Ofqual-regulated qualifications awarded through VTCT (Levels 2–4); CPD-accredited short courses; advanced Level 5–7 programmes.' },
    { label: 'Delivery', value: 'Blended: online theory on Thinkific at your own pace, then practical days in clinic. VTCT exam administered in-house.' },
    { label: 'Courses', value: courses.length ? `${courses.length} course${courses.length === 1 ? '' : 's'} open for enrolment${lowestFee ? `, from ${formatFee(lowestFee)}` : ''}. Enrol any time; join the next suitable cohort.` : 'Enrol any time; you join the next suitable cohort.' },
    { label: 'Paying', value: 'Monthly course finance (subject to status) or self / employer funded.' },
    { label: 'Government funding', value: 'Not available through K Academy at present and not expected before 2028. Register interest on the funding page.' },
  ];

  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }]),
        academyLd(),
        courses.length ? itemListLd('K Academy courses', courses.map((c) => ({ name: c.title, path: `/academy/${c.slug}` }))) : null,
        faqLd(academyFaqs),
      ]} />
      <PageHero
        eyebrow="K Academy"
        title="Train to the standard you’d want to be treated by."
        lede="Accredited aesthetics training in the heart of Islington — Ofqual-regulated, VTCT and CPD-accredited, from foundation through to advanced Level 7. Build a career, not just a certificate."
        gradient={['#2a2420', '#7b6a5d']}
      >
        <div className="flex flex-wrap gap-3">
          <Button href="#courses" variant="gold">Explore courses <ArrowIcon /></Button>
          <Button href="/academy/funding" variant="outline">Funding &amp; finance</Button>
          <Button href="/academy/portal" variant="outline">Trainee login</Button>
        </div>
      </PageHero>

      <AcademyBanner />

      {/* Promo banner — shown only when at least one course has an active promo */}
      {lowestPromo != null && (
        <div className="bg-[var(--color-gold-deep)] text-[var(--color-porcelain)]">
          <div className="container-lux flex flex-wrap items-center justify-between gap-3 py-3">
            <p className="text-sm font-medium">
              Special offer: courses from {formatFee(lowestPromo)} — limited time.
            </p>
            <a href="#courses" className="shrink-0 text-sm underline underline-offset-2 hover:no-underline">
              See courses
            </a>
          </div>
        </div>
      )}

      {/* Accreditation badges */}
      <section className="container-lux pt-12">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm uppercase tracking-[0.16em] text-[var(--color-stone)]">
          {Object.values(ACCREDITATION_LABELS).map((l) => (
            <span key={l} className="flex items-center gap-2"><span className="text-[var(--color-gold-deep)]">✦</span>{l}</span>
          ))}
          <span className="flex items-center gap-2"><span className="text-[var(--color-gold-deep)]">✦</span>Levels 2–7</span>
        </div>
      </section>

      {/* Pillars */}
      <section className="container-lux section">
        <h2 className="sr-only">Why train at K Academy</h2>
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

      {/* At a glance — plain, citable facts (GEO) */}
      <section className="container-lux section pt-0">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 md:p-10">
            <p className="eyebrow mb-3">At a glance</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl">K Academy in six facts.</h2>
            <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {AT_A_GLANCE.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold-deep)]">{f.label}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </section>

      {/* Courses */}
      <section id="courses" className="container-lux section">
        <Reveal>
          <p className="eyebrow mb-3">Courses</p>
          <h2 className="text-title">Qualifications that open doors.</h2>
          <p className="mt-3 max-w-2xl text-[var(--color-ink-soft)]">Spread the cost monthly, or see if you qualify for government or London funding — explore your <Link href="/academy/funding" className="link-underline font-medium text-[var(--color-ink)]">funding options</Link>. Enrol any time; we’ll place you in the next suitable cohort.</p>
        </Reveal>
        {courses.length === 0 ? (
          <p className="mt-8 text-[var(--color-stone)]">Our course schedule is being finalised — <Link href="/academy/portal" className="link-underline">register your interest</Link> and we’ll be in touch.</p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const promo = getActivePromo(c);
              return (
                <Reveal key={c.id}>
                  <Link href={`/academy/${c.slug}`} className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 transition-colors hover:border-[var(--color-gold)]">
                    {c.level && <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold-deep)]">{c.level}</span>}
                    <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl leading-tight">{c.title}</h3>
                    {c.summary && <p className="mt-2 flex-1 text-sm text-[var(--color-ink-soft)]">{c.summary}</p>}
                    <div className="mt-4 flex items-center justify-between">
                      {promo ? (
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-sm font-medium text-[var(--color-gold-deep)]">{formatFee(promo)}</span>
                          <span className="text-xs text-[var(--color-stone)] line-through">{formatFee(c.pricePence)}</span>
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-[var(--color-ink)]">{formatFee(c.pricePence)}</span>
                      )}
                      <span className="text-sm text-[var(--color-gold-deep)] group-hover:underline">View course →</span>
                    </div>
                    {c.accreditations.length > 0 && <p className="mt-2 text-[0.7rem] uppercase tracking-wide text-[var(--color-stone)]">{c.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(' · ')}</p>}
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>

      {/* Learning pathways (bundles) */}
      {bundles.length > 0 && (
        <section className="container-lux section">
          <Reveal>
            <p className="eyebrow mb-3">Learning pathways</p>
            <h2 className="text-title">Not sure where to start? Follow a route.</h2>
            <p className="mt-3 max-w-2xl text-[var(--color-ink-soft)]">Each pathway sequences several courses so you progress in the right order — foundation first, then on to advanced.</p>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => <BundleCard key={b.id} bundle={b} />)}
          </div>
        </section>
      )}

      {/* Funding */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 md:p-14">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="eyebrow mb-3">Funding &amp; finance</p>
                <h2 className="font-[family-name:var(--font-display)] text-3xl">Worried about the cost? You have options.</h2>
                <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">Spread the cost month by month, or ask your employer to sponsor you. {FUNDING_OUTLOOK.split('. ')[0]}. Because our Level 2–4 courses are Ofqual-regulated, they will qualify for those routes when they open, so register your interest now.</p>
              </div>
              <Button href="/academy/funding" variant="gold">See ways to pay <ArrowIcon /></Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Equipment leasing */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-ink)] p-10 text-[var(--color-porcelain)] md:p-14">
            <p className="eyebrow eyebrow-on-dark mb-3">After you qualify</p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl">Launch your practice — equipment leasing for graduates.</h2>
            <p className="mt-4 max-w-2xl text-[var(--color-porcelain)]/80">Qualifying with K Academy is the beginning. Eligible graduates can lease clinic-grade laser and aesthetic devices on flexible terms, so you can start treating clients without the upfront capital.</p>
            <div className="mt-6"><Button href="/academy/portal" variant="gold">Ask about leasing <ArrowIcon /></Button></div>
          </div>
        </Reveal>
      </section>

      {/* FAQs (mirrored in FAQPage JSON-LD above and in /llms.txt) */}
      <section className="container-lux section">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[0.5fr_1.5fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow mb-3">Questions</p>
              <h2 className="text-title">Before you apply.</h2>
              <p className="mt-3 text-sm text-[var(--color-stone)]">Our learner and centre policies are published at <Link href="/academy/policies" className="link-underline">Centre policies</Link>.</p>
            </div>
            <FaqAccordion faqs={academyFaqs} />
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="container-lux section text-center">
        <Reveal>
          <h2 className="text-title">Ready to begin?</h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--color-ink-soft)]">Choose a course to apply, or talk to our team. Call <PhoneLink className="link-underline font-medium text-[var(--color-ink)]" />.</p>
          <div className="mt-6 flex justify-center"><Button href="#courses" variant="gold">Browse courses <ArrowIcon /></Button></div>
        </Reveal>
      </section>
    </>
  );
}
