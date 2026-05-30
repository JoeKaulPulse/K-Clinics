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
        gradient={['#c9a86a', '#3a2730']}
      >
        <BookingButtons />
      </PageHero>

      <section className="container-lux py-20 md:py-28">
        <Stagger className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier, i) => (
            <StaggerItem key={tier.name}>
              <div className="flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8">
                <p className="font-[family-name:var(--font-display)] text-6xl text-gold-gradient">{String(i + 1).padStart(2, '0')}</p>
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
