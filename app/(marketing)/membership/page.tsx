import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { LOYALTY } from '@/lib/client-loyalty';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Membership & Beauty Points Rewards | K Clinics London',
  description:
    'Join K Clinics’ free Beauty Points programme — earn 1 point per £1, plus bonuses for reviews, birthdays and referrals. Redeem points as money off future treatments in Islington, London.',
  path: '/membership',
  keywords: ['clinic membership London', 'beauty rewards programme', 'loyalty points aesthetics'],
});

const pounds = (pence: number) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;

const EARN = [
  { icon: '✦', t: 'Every treatment', v: `${LOYALTY.pointsPerPound} pt / £1`, d: 'Earn a point for every pound you spend on treatments and packages — added automatically once your visit is complete.' },
  { icon: '★', t: 'Leave a review', v: `+${LOYALTY.reviewBonus} pts`, d: `Share your experience after a visit and we’ll thank you with ${pounds(LOYALTY.reviewBonus)} in points.` },
  { icon: '🎂', t: 'Your birthday', v: `+${LOYALTY.birthdayBonus} pts`, d: `A little gift each year — ${pounds(LOYALTY.birthdayBonus)} in points lands on your birthday to spend on yourself.` },
  { icon: '♥', t: 'Refer a friend', v: `+${pounds(LOYALTY.referralReward)}`, d: `Give £25, get £25. When a friend you refer completes their first treatment of ${pounds(LOYALTY.referralThresholdPence)}+, you both earn ${pounds(LOYALTY.referralReward)}.` },
];

const STEPS = [
  { t: 'Earn as you go', d: 'Points collect automatically against your account — no card to carry, nothing to remember. Track your balance any time in your client portal.' },
  { t: 'Redeem your way', d: `Every 100 points is worth £1. Apply them as money off at checkout — up to ${Math.round(LOYALTY.maxRedeemFraction * 100)}% of any treatment, from a minimum of 100 points.` },
  { t: 'Keep them fresh', d: `Points stay valid for ${LOYALTY.expiryMonths} months from the day you earn them, so there’s always a reason to treat yourself again soon.` },
];

export default function MembershipPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Membership', path: '/membership' }])} />
      <PageHero
        eyebrow="Beauty Points · Membership"
        title="Rewarded for radiance."
        lede="Our free rewards programme. Earn Beauty Points every time you visit — plus bonuses for reviews, birthdays and referrals — and turn them into money off your next treatment."
        gradient={['#c2a589', '#3d352f']}
      >
        <BookingButtons />
      </PageHero>

      {/* At a glance */}
      <section className="border-b border-[var(--color-line)] bg-[var(--color-bone)]">
        <div className="container-lux grid gap-6 py-10 text-center sm:grid-cols-3">
          {[
            { v: '1 pt = £1', l: 'Earn a point per pound spent' },
            { v: '100 pts = £1', l: 'Redeemed as money off' },
            { v: 'Free to join', l: 'Automatic from your first visit' },
          ].map((s) => (
            <Reveal key={s.l}>
              <div>
                <p className="font-[family-name:var(--font-display)] text-3xl text-gold-gradient">{s.v}</p>
                <p className="mt-1 text-sm text-[var(--color-stone)]">{s.l}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container-lux section">
        {/* Ways to earn */}
        <Reveal>
          <p className="eyebrow mb-3 text-center">Ways to earn</p>
          <h2 className="text-title mx-auto max-w-2xl text-center">Four ways your points add up.</h2>
        </Reveal>
        <Stagger className="mt-[var(--space-block)] grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {EARN.map((e) => (
            <StaggerItem key={e.t}>
              <div className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-7 transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:border-[color-mix(in_oklab,var(--color-gold)_45%,var(--color-line))] hover:bg-[var(--color-porcelain)] hover:shadow-[var(--shadow-lift)]">
                <span className="text-2xl text-[var(--color-gold)]" aria-hidden>{e.icon}</span>
                <p className="mt-4 font-[family-name:var(--font-display)] text-2xl text-gold-gradient">{e.v}</p>
                <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg">{e.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{e.d}</p>
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
            {STEPS.map((s, i) => (
              <StaggerItem key={s.t}>
                <div className="h-full rounded-[var(--radius-lg)] border border-[var(--color-line)] p-8">
                  <span className="font-[family-name:var(--font-display)] text-3xl text-gold-gradient">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl">{s.t}</h3>
                  <p className="mt-2 leading-relaxed text-[var(--color-stone)]">{s.d}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-[var(--color-stone)]">
              Manage your balance, see what’s expiring and grab your referral link any time from your <a href="/account/rewards" className="link-underline font-medium text-[var(--color-ink)]">rewards page</a>. Questions? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.
            </p>
          </Reveal>
        </div>

        <Reveal>
          <div className="surface-ink grain relative mt-16 overflow-hidden rounded-[var(--radius-2xl)] p-10 text-center md:p-16">
            <div className="relative">
              <h2 className="text-title text-[var(--color-porcelain)]">Membership is complimentary — simply begin.</h2>
              <p className="mx-auto mt-4 max-w-xl text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">
                Create your account and your points start accruing from your very first treatment. Book in, and we’ll do the rest.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button href="/account/signup" variant="gold">Create your account <ArrowIcon /></Button>
                <Button href="/book" variant="outline">Book a treatment</Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
