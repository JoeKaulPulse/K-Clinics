import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { FundingWizard } from '@/components/academy/FundingWizard';
import { FUNDING_ROUTES } from '@/lib/funding';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Funding & Finance — Pay for Your Training | K Academy London',
  description:
    'Ways to fund your aesthetics training at K Academy, Islington. Monthly course finance, employer sponsorship, and government and council funding routes including Advanced Learner Loans and the Mayor of London Adult Skills Fund. Check what you could use.',
  path: '/academy/funding',
  keywords: ['aesthetics course funding', 'advanced learner loan aesthetics', 'pay monthly aesthetics training', 'adult skills fund London', 'student funding aesthetics academy'],
});

export const revalidate = 3600;

const FAQS = [
  { q: 'Do I have to pay anything up front?', d: 'Not to enquire. With monthly course finance you typically pay a small deposit and spread the rest. With government loans your fees are paid for you and you repay later, once you earn over the threshold. We never take payment until your place and funding are confirmed.' },
  { q: 'Is the Advanced Learner Loan like a student loan?', d: 'Yes. It is a government loan that covers your course fee, is not means-tested, and you only start repaying once you earn above the income threshold. Any balance left after the set period is written off. We are applying to offer these on our regulated Level 3 and Level 4 courses.' },
  { q: 'I’m unemployed or on a low income — can I train for free?', d: 'Possibly. London adult education funding (the Mayor of London Adult Skills Fund) can fully fund eligible Londoners aged 19+, with priority for people who are unemployed or on a low wage. Register your interest and we’ll check what you qualify for.' },
  { q: 'I live in Islington — does that help?', d: 'It can. We’re building a partnership with Islington Adult Community Learning so residents can access funded places. Tell us you’re an Islington resident in the form and we’ll keep you posted.' },
  { q: 'Does applying affect my credit score?', d: 'Enquiring with us does not. Monthly course finance uses a soft check to show your options, which doesn’t affect your score; only a full application with the finance provider does. Government funding routes don’t involve a credit check at all.' },
];

export default function AcademyFundingPage() {
  const financeApplyUrl = process.env.COURSE_FINANCE_URL || '';

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Academy', path: '/academy' }, { name: 'Funding & Finance', path: '/academy/funding' }])} />
      <PageHero
        eyebrow="K Academy · Funding & finance"
        title="Don’t let cost stand in your way."
        lede="There’s more than one way to pay for your training. From spreading the cost monthly to government and London funding for those who qualify — find the route that works for you, and we’ll help you apply."
        gradient={['#2a2420', '#7b6a5d']}
      >
        <div className="flex flex-wrap gap-3">
          <Button href="#check" variant="gold">Check your options <ArrowIcon /></Button>
          <Button href="/academy#courses" variant="outline">Browse courses</Button>
        </div>
      </PageHero>

      {/* Routes */}
      <section className="container-lux section">
        <Reveal>
          <p className="eyebrow mb-3">Ways to pay</p>
          <h2 className="text-title">Five ways to fund your course.</h2>
          <p className="mt-3 max-w-2xl text-[var(--color-ink-soft)]">Our Level 2–4 courses are Ofqual-regulated qualifications, which is what makes them eligible for government and council funding. Some routes are open today; others we’re getting approved — register your interest and we’ll tell you the moment they go live.</p>
        </Reveal>
        <Stagger className="mt-10 grid gap-6 md:grid-cols-2">
          {FUNDING_ROUTES.map((r) => (
            <StaggerItem key={r.key}>
              <div className="flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-[family-name:var(--font-display)] text-xl">{r.name}</h3>
                  {r.status === 'available'
                    ? <span className="rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-[var(--color-gold-soft)]">Available now</span>
                    : <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-[var(--color-stone)]">Register interest</span>}
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex gap-2"><dt className="shrink-0 text-[var(--color-stone)]">For</dt><dd className="text-[var(--color-ink)]">{r.who}</dd></div>
                  <div className="flex gap-2"><dt className="shrink-0 text-[var(--color-stone)]">How</dt><dd className="text-[var(--color-ink)]">{r.pays}</dd></div>
                </dl>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{r.detail}</p>
                {r.note && <p className="mt-3 text-xs text-[var(--color-stone)]">{r.note}</p>}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Eligibility wizard */}
      <section id="check" className="bg-[var(--color-bone)] section scroll-mt-28">
        <div className="container-lux grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <Reveal>
            <p className="eyebrow mb-3">Check your options</p>
            <h2 className="text-title">What could you use?</h2>
            <p className="mt-5 text-lede leading-relaxed text-[var(--color-stone)]">Answer six quick questions and we’ll show the funding routes that fit your situation, then help you apply. It takes under a minute and there’s no obligation.</p>
            <ul className="mt-6 space-y-3 text-[var(--color-ink-soft)]">
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> No credit check to see your options.</li>
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> A real person follows up — not an automated decision.</li>
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> We confirm exactly what you qualify for before anything is agreed.</li>
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <FundingWizard financeApplyUrl={financeApplyUrl} />
          </Reveal>
        </div>
      </section>

      {/* Monthly finance detail */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 md:p-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <p className="eyebrow mb-3">Available today</p>
                <h2 className="text-title">Spread the cost, month by month.</h2>
                <p className="mt-4 text-[var(--color-ink-soft)]">Pay a small deposit and split the rest into manageable monthly instalments through our finance partner. A quick application, a soft check that won’t affect your credit score, and your place is held while you pay.</p>
                <p className="mt-4 text-xs text-[var(--color-stone)]">Finance is provided by a third party, not by K Academy. Subject to status and eligibility; 18+, UK residents. Missed payments may incur fees charged by the provider. Please review the provider’s terms before you commit.</p>
              </div>
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-7 text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl">Worked example</p>
                <p className="mt-2 text-sm text-[var(--color-stone)]">A £3,500 Level 4 course</p>
                <p className="mt-5 font-[family-name:var(--font-display)] text-4xl text-gold-gradient">12 × £292</p>
                <p className="mt-2 text-sm text-[var(--color-stone)]">illustrative monthly instalments</p>
                <p className="mt-5 text-xs text-[var(--color-stone)]">Illustrative only. Actual terms, deposit and instalments depend on the provider and your eligibility.</p>
                <div className="mt-6"><Button href="#check" variant="gold">Check eligibility <ArrowIcon /></Button></div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="bg-[var(--color-bone)] section">
        <div className="container-lux">
          <Reveal>
            <p className="eyebrow mb-3">Funding questions</p>
            <h2 className="text-title">Good to know.</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FAQS.map((f) => (
              <Reveal key={f.q}>
                <div className="h-full rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
                  <h3 className="font-[family-name:var(--font-display)] text-lg">{f.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] p-8 text-center md:p-12">
            <h2 className="text-title">Not sure where to start?</h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-stone)]">Tell us your goal and we’ll find the most affordable way in. Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a> or <Link href="#check" className="link-underline font-medium text-[var(--color-ink)]">check your options online</Link>.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button href="#check" variant="gold">Check your funding options <ArrowIcon /></Button>
              <Button href="/academy" variant="outline">Explore K Academy</Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
