import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { site } from '@/lib/site';
import { PhoneLink } from '@/components/marketing/PhoneLink';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

// BLD-517: hourly ISR so these mostly-static pages are cached, not full SSR per request.
export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Cost & Finance — Flexible Payment Options | KClinics London',
  description:
    'Transparent, published pricing at KClinics, Islington — pay-as-you-go treatment courses and 0% interest-free options on eligible treatments.',
  path: '/finance',
  keywords: ['pay monthly aesthetics London', '0% finance treatment'],
});

const WAYS = [
  { t: 'Transparent pricing', d: 'Every treatment and course price is published up front — no hidden fees, ever. You’ll always know the full cost before you commit.' },
  { t: 'Pay as you go', d: 'Pay per session as you progress through a course, so you can spread the cost naturally over your treatment plan.' },
  { t: 'Consultation credited', d: 'Where a consultation fee applies (e.g. dental implants), it’s credited towards the cost of your treatment when you proceed.' },
  { t: '0% interest-free options', d: 'On eligible higher-value treatments we offer flexible, interest-free payment plans so you can focus on your care, not the cost.' },
];

export default async function FinancePage() {
  const { getPublishedPage } = await import('@/lib/pages');
  const cms = await getPublishedPage('/finance');
  if (cms) {
    const { SectionRenderer } = await import('@/components/cms/SectionRenderer');
    return (<><JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Cost & Finance', path: '/finance' }])} /><SectionRenderer sections={cms} /></>);
  }
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Cost & Finance', path: '/finance' }])} />
      <PageHero
        eyebrow="Cost & finance"
        title="Care that fits your budget."
        lede="Exceptional treatment shouldn’t mean compromise. We keep pricing transparent and offer flexible ways to pay, so you can move forward with confidence."
        gradient={['#3d352f', '#a98a6d']}
      >
        <div className="flex flex-wrap gap-3">
          <Button href="/pricing" variant="gold">See the full price list <ArrowIcon /></Button>
        </div>
      </PageHero>

      <section className="container-lux section">
        <Stagger className="grid gap-6 md:grid-cols-2">
          {WAYS.map((w) => (
            <StaggerItem key={w.t}>
              <div className="h-full rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8">
                <h3 className="font-[family-name:var(--font-display)] text-xl">{w.t}</h3>
                <p className="mt-2 leading-relaxed text-[var(--color-ink-soft)]">{w.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] p-8 text-center md:p-12">
            <h2 className="text-title">Questions about paying?</h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-stone)]">
              Our team will happily talk you through the options and what suits you best. Call <PhoneLink className="link-underline font-medium text-[var(--color-ink)]" /> or email <a href={site.emailHref} className="link-underline font-medium text-[var(--color-ink)]">{site.email}</a>.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button href="/pricing" variant="gold">View pricing <ArrowIcon /></Button>
              <Button href="/consultation" variant="outline">Book a free consultation</Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
