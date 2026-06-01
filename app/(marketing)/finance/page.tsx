import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Cost & Finance — Flexible Payment Options | K Clinics London',
  description:
    'Spread the cost of your treatment at K Clinics, Islington. Transparent pricing, pay-as-you-go courses, 0% interest-free options and Buy Now, Pay Later with Clearpay and Klarna.',
  path: '/finance',
  keywords: ['pay monthly aesthetics London', 'buy now pay later clinic', '0% finance treatment', 'Clearpay Klarna clinic'],
});

const WAYS = [
  { t: 'Transparent pricing', d: 'Every treatment and course price is published up front — no hidden fees, ever. You’ll always know the full cost before you commit.' },
  { t: 'Pay as you go', d: 'Pay per session as you progress through a course, so you can spread the cost naturally over your treatment plan.' },
  { t: 'Consultation credited', d: 'Where a consultation fee applies (e.g. dental implants), it’s credited towards the cost of your treatment when you proceed.' },
  { t: '0% interest-free options', d: 'On eligible higher-value treatments we offer flexible, interest-free payment plans so you can focus on your care, not the cost.' },
];

export default function FinancePage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Cost & Finance', path: '/finance' }])} />
      <PageHero
        eyebrow="Cost & finance"
        title="Care that fits your budget."
        lede="Exceptional treatment shouldn’t mean compromise. We keep pricing transparent and offer flexible ways to pay — including Buy Now, Pay Later — so you can move forward with confidence."
        gradient={['#3d352f', '#a98a6d']}
      >
        <div className="flex flex-wrap gap-3">
          <Button href="/pricing" variant="gold">See the full price list <ArrowIcon /></Button>
          <Button href="#buy-now-pay-later" variant="outline">Buy Now, Pay Later</Button>
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

      {/* Buy Now, Pay Later */}
      <section id="buy-now-pay-later" className="bg-[var(--color-bone)] section scroll-mt-28">
        <div className="container-lux grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <Reveal>
            <p className="eyebrow mb-3">Buy now, pay later</p>
            <h2 className="text-title">Spread the cost, interest-free.</h2>
            <p className="mt-5 text-lede leading-relaxed text-[var(--color-stone)]">
              Split your treatment into smaller, manageable instalments at checkout with <strong className="text-[var(--color-ink)]">Clearpay</strong> or <strong className="text-[var(--color-ink)]">Klarna</strong>. Quick to set up, with no impact on the care you receive.
            </p>
            <ul className="mt-6 space-y-3 text-[var(--color-ink-soft)]">
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> Choose Clearpay or Klarna when you pay.</li>
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> Pay in interest-free instalments over a few weeks or months.</li>
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> A soft check at sign-up — your treatment plan stays exactly the same.</li>
            </ul>
            <p className="mt-6 text-xs text-[var(--color-stone-soft)]">
              Buy Now, Pay Later is provided by Clearpay and Klarna, not by K Clinics. Subject to status and eligibility; 18+, UK residents. Missed payments may affect your ability to use these services and could incur fees charged by the provider. Please review each provider’s terms before you commit.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
              <p className="font-[family-name:var(--font-display)] text-2xl">Worked example</p>
              <p className="mt-2 text-sm text-[var(--color-stone)]">A £400 course of treatment</p>
              <p className="mt-6 font-[family-name:var(--font-display)] text-5xl text-gold-gradient">4 × £100</p>
              <p className="mt-2 text-sm text-[var(--color-stone)]">interest-free, paid fortnightly with Clearpay</p>
              <p className="mt-6 text-xs text-[var(--color-stone-soft)]">Illustrative only. Actual instalments depend on the provider, your basket and eligibility.</p>
              <div className="mt-7"><Button href="/book" variant="gold">Book & choose your plan <ArrowIcon /></Button></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] p-8 text-center md:p-12">
            <h2 className="text-title">Questions about paying?</h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-stone)]">
              Our team will happily talk you through the options and what suits you best. Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a> or email <a href={site.emailHref} className="link-underline font-medium text-[var(--color-ink)]">{site.email}</a>.
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
