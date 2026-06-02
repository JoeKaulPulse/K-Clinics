import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { ApplyForm } from '@/components/careers/ApplyForm';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Careers — Join K Clinics | Islington, London',
  description: 'Build your career at K Clinics, Islington — a place that invests in its people. See our live vacancies and apply, or send a speculative application.',
  path: '/careers',
  keywords: ['aesthetics jobs London', 'clinic careers Islington', 'cosmetic dentistry jobs'],
});

export const revalidate = 300; // ISR: cached, revalidated in the background

const PERKS = [
  { t: 'Grow with us', d: 'Funded training and a clear path — including places at K Academy, our accredited training centre.' },
  { t: 'Work somewhere beautiful', d: 'A flagship Islington clinic with the latest devices and a team that takes pride in doing things properly.' },
  { t: 'Looked after', d: 'Competitive pay, staff treatment perks and a culture that genuinely cares how you feel at work.' },
];

export default async function CareersPage() {
  const { db } = await import('@/lib/db');
  let vacancies: { id: string; title: string; department: string | null; location: string | null; type: string | null; summary: string | null; description: string | null }[] = [];
  try {
    vacancies = await db.vacancy.findMany({ where: { active: true }, orderBy: [{ order: 'asc' }, { createdAt: 'desc' }], select: { id: true, title: true, department: true, location: true, type: true, summary: true, description: true } });
  } catch { /* DB optional */ }

  const jobsLd = vacancies.map((v) => ({ '@context': 'https://schema.org', '@type': 'JobPosting', title: v.title, description: v.summary || v.title, employmentType: v.type || undefined, hiringOrganization: { '@type': 'Organization', name: site.name }, jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: v.location || site.address.locality, addressCountry: 'GB' } } }));

  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Careers', path: '/careers' }]), ...jobsLd]} />
      <PageHero eyebrow="Careers" title="Do the best work of your career." lede="We’re building London’s most considered clinic — and that takes exceptional people. If you care about craft, safety and how clients feel, we’d love to hear from you." gradient={['#3d352f', '#7b6a5d']}>
        <Link href="#apply" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-gold)] px-7 py-3.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">Apply now →</Link>
      </PageHero>

      <section className="container-lux section">
        <div className="grid gap-8 md:grid-cols-3">
          {PERKS.map((p, i) => (
            <Reveal key={p.t} delay={i * 0.08}><div><h3 className="font-[family-name:var(--font-display)] text-xl">{p.t}</h3><p className="mt-2 text-[var(--color-ink-soft)]">{p.d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section className="container-lux section">
        <Reveal><p className="eyebrow mb-3">Open roles</p><h2 className="text-title">Live vacancies.</h2></Reveal>
        {vacancies.length === 0 ? (
          <p className="mt-6 text-[var(--color-stone)]">No specific vacancies right now — but we’re always glad to meet great people. Send a speculative application below.</p>
        ) : (
          <div className="mt-8 space-y-4">
            {vacancies.map((v) => (
              <Reveal key={v.id}>
                <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-[family-name:var(--font-display)] text-xl">{v.title}</h3>
                    <span className="text-sm text-[var(--color-stone)]">{[v.type, v.location || site.address.locality, v.department].filter(Boolean).join(' · ')}</span>
                  </div>
                  {v.summary && <p className="mt-2 text-[var(--color-ink-soft)]">{v.summary}</p>}
                  {v.description && <p className="mt-3 whitespace-pre-line text-sm text-[var(--color-stone)]">{v.description}</p>}
                  <a href="#apply" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold)] hover:underline">Apply for this role →</a>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <section id="apply" className="container-lux section grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <h2 className="text-title">Apply to K Clinics.</h2>
            <p className="mt-4 text-[var(--color-ink-soft)]">Pick a role or send a speculative application. Prefer to talk first? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.</p>
            <Link href="/" className="mt-6 inline-block text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Back to the homepage</Link>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <ApplyForm roles={vacancies.map((v) => ({ id: v.id, title: v.title }))} />
        </Reveal>
      </section>
    </>
  );
}
