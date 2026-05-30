import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Membership & Beauty Points Rewards | K Clinics London',
  description:
    'Join K Clinics’ Beauty Points programme — earn rewards on every treatment, with priority booking, members-only events and seasonal privileges in Islington, London.',
  path: '/membership',
  keywords: ['clinic membership London', 'beauty rewards programme', 'loyalty points aesthetics'],
});

const tiers = [
  {
    name: 'Earn',
    headline: 'Beauty Points on every visit',
    perks: ['Points on all treatments & packages', 'Redeem against future visits', 'Birthday treat each year'],
  },
  {
    name: 'Enjoy',
    headline: 'Privileges as you grow',
    perks: ['Priority appointment access', 'Early access to new treatments', 'Exclusive seasonal offers'],
  },
  {
    name: 'Elevate',
    headline: 'The inner circle',
    perks: ['Invitations to members’ events', 'Complimentary annual skin review', 'Dedicated concierge booking'],
  },
];

export default function MembershipPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Membership', path: '/membership' }])} />
      <PageHero
        eyebrow="Beauty Points · Membership"
        title="Rewarded for radiance."
        lede="Our way of saying thank you. Every treatment earns Beauty Points and unlocks privileges designed to make looking — and feeling — your best even more rewarding."
        gradient={['#c2a589', '#3d352f']}
      >
        <BookingButtons />
      </PageHero>

      <section className="container-lux section">
        <Stagger className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier, i) => (
            <StaggerItem key={tier.name}>
              <div className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:border-[color-mix(in_oklab,var(--color-gold)_45%,var(--color-line))] hover:bg-[var(--color-porcelain)] hover:shadow-[var(--shadow-lift)]">
                <p className="font-[family-name:var(--font-display)] text-6xl text-gold-gradient transition-transform duration-700 [transition-timing-function:var(--ease-spring)] group-hover:scale-110 group-hover:[transform-origin:left]">{String(i + 1).padStart(2, '0')}</p>
                <p className="eyebrow mt-4">{tier.name}</p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl leading-snug">{tier.headline}</h2>
                <ul className="mt-6 space-y-3">
                  {tier.perks.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[var(--color-stone)]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-gold)]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        {/* How it works */}
        <div className="mt-20">
          <Reveal>
            <p className="eyebrow mb-3 text-center">How Beauty Points work</p>
            <h2 className="text-title mx-auto max-w-2xl text-center">Earn as you go, enjoy more each visit.</h2>
          </Reveal>
          <Stagger className="mt-[var(--space-block)] grid gap-6 md:grid-cols-3">
            {[
              { t: 'Earn on every treatment', d: 'Collect Beauty Points automatically each time you visit — the more you invest in yourself, the more you’re rewarded.' },
              { t: 'Unlock privileges', d: 'Points and tiers unlock priority booking, complimentary upgrades, members-only events and seasonal gifts.' },
              { t: 'Redeem your way', d: 'Put points towards treatments and products whenever it suits you — your clinician will help you make the most of them.' },
            ].map((s, i) => (
              <StaggerItem key={s.t}>
                <div className="h-full rounded-[var(--radius-lg)] border border-[var(--color-line)] p-8">
                  <span className="font-[family-name:var(--font-display)] text-3xl text-gold-gradient">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl">{s.t}</h3>
                  <p className="mt-2 leading-relaxed text-[var(--color-stone)]">{s.d}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <Reveal>
          <div className="surface-ink grain relative mt-16 overflow-hidden rounded-[var(--radius-2xl)] p-10 text-center md:p-16">
            <div className="relative">
              <h2 className="text-title text-[var(--color-porcelain)]">Membership is complimentary — simply begin.</h2>
              <p className="mx-auto mt-4 max-w-xl text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">
                Your points start accruing from your very first treatment. Book in, and we’ll do the rest.
              </p>
              <div className="mt-8 flex justify-center">
                <BookingButtons align="center" />
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
