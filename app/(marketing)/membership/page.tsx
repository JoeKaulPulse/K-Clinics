import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { Glyph } from '@/components/ui/Glyph';
import { LOYALTY } from '@/lib/client-loyalty';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Membership & Beauty Points Rewards | KClinics London',
  description:
    "Join KClinics' free Beauty Points programme -- earn 1 point per £1, plus bonuses for reviews, birthdays and referrals. Redeem points as money off future treatments in Islington, London.",
  path: '/membership',
  keywords: ['clinic membership London', 'beauty rewards programme', 'loyalty points aesthetics'],
});

const pounds = (pence: number) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;

const EARN = [
  { icon: '✦', t: 'Every treatment', v: `${LOYALTY.pointsPerPound} pt / £1`, d: 'Earn a point for every pound you spend on treatments and packages -- added automatically once your visit is complete.' },
  { icon: '★', t: 'Leave a review', v: `+${LOYALTY.reviewBonus} pts`, d: `Share your experience after a visit and we'll thank you with ${pounds(LOYALTY.reviewBonus)} in points.` },
  { icon: <Glyph name="cake" className="mx-auto h-6 w-6" />, t: 'Your birthday', v: `+${LOYALTY.birthdayBonus} pts`, d: `A little gift each year -- ${pounds(LOYALTY.birthdayBonus)} in points lands on your birthday to spend on yourself.` },
  { icon: '♥', t: 'Refer a friend', v: `+${pounds(LOYALTY.referralReward)}`, d: `Give £25, get £25. When a friend you refer completes their first treatment of ${pounds(LOYALTY.referralThresholdPence)}+, you both earn ${pounds(LOYALTY.referralReward)}.` },
];

const STEPS = [
  { t: 'Earn as you go', d: 'Points collect automatically against your account -- no card to carry, nothing to remember. Track your balance any time in your client portal.' },
  { t: 'Redeem your way', d: `Every 100 points is worth £1. Apply them as money off at checkout -- up to ${Math.round(LOYALTY.maxRedeemFraction * 100)}% of any treatment, from a minimum of 100 points.` },
  { t: 'Keep them fresh', d: `Points stay valid for ${LOYALTY.expiryMonths} months from the day you earn them, so there's always a reason to treat yourself again soon.` },
];

export default async function MembershipPage() {
  const { getPublishedPage } = await import('@/lib/pages');
  const cms = await getPublishedPage('/membership');
  if (cms) {
    const { SectionRenderer } = await import('@/components/cms/SectionRenderer');
    return (<><JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Membership', path: '/membership' }])} /><SectionRenderer sections={cms} /></>);
  }
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Membership', path: '/membership' }])} />
      <PageHero
        eyebrow="Beauty Points · Membership"
        title="Rewarded for radiance."
        lede="Our free rewards programme. Earn Beauty Points every time you visit -- plus bonuses for reviews, birthdays and referrals -- and turn them into money off your next treatment."
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
              Manage your balance, see what's expiring and grab your referral link any time from your <a href="/account/rewards" className="link-underline font-medium text-[var(--color-ink)]">rewards page</a>. Questions? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.
            </p>
          </Reveal>
        </div>

        {/* Loyalty leaderboard -- only rendered when opted-in members exist */}
        <Leaderboard />

        <Reveal>
          <div className="surface-ink grain relative mt-16 overflow-hidden rounded-[var(--radius-2xl)] p-10 text-center md:p-16">
            <div className="relative">
              <h2 className="text-title text-[var(--color-porcelain)]">Membership is complimentary -- simply begin.</h2>
              <p className="mx-auto mt-4 max-w-xl text-[color-mix(in_oklab,var(--color-porcelain)_72%,transparent)]">
                Create your account and your points start accruing from your very first treatment. Book in, and we'll do the rest.
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

const MEDAL = ['🥇', '🥈', '🥉'];

async function Leaderboard() {
  type Entry = { id: string; name: string; photoUrl: string | null; tier: string | null; totalPoints: number };
  let entries: Entry[] = [];
  try {
    const { db } = await import('@/lib/db');
    const clients = await db.client.findMany({
      where: { leaderboardOptIn: true },
      select: { id: true, firstName: true, leaderboardDisplayName: true, leaderboardPhotoUrl: true, membershipTier: true, points: { select: { points: true } } },
      take: 50,
    });
    entries = clients
      .map((c) => ({ id: c.id, name: c.leaderboardDisplayName || c.firstName || 'Member', photoUrl: c.leaderboardPhotoUrl ?? null, tier: c.membershipTier ?? null, totalPoints: c.points.reduce((s: number, r: { points: number }) => s + r.points, 0) }))
      .filter((e) => e.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 12);
  } catch { /* DB optional -- skip the section if unavailable */ }

  if (entries.length === 0) return null;

  return (
    <div className="mt-20">
      <Reveal>
        <p className="eyebrow mb-3 text-center">Our community</p>
        <h2 className="text-title mx-auto max-w-2xl text-center">Our most loyal members.</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[var(--color-stone)]">
          Members who&apos;ve kindly agreed to be featured. Want to appear here? Let us know at your next visit.
        </p>
      </Reveal>
      <Stagger className="mt-[var(--space-block)] grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {entries.map((e, i) => (
          <StaggerItem key={e.id}>
            <div className="flex items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
              {e.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.photoUrl} alt={`${e.name} -- KClinics member`} width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] font-[family-name:var(--font-display)] text-xl text-[var(--color-gold-soft)]" aria-hidden>
                  {(e.name[0] || '?').toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-base leading-tight">
                  {i < 3 && <span aria-hidden>{MEDAL[i]}</span>}
                  <span className="truncate">{e.name}</span>
                </p>
                {e.tier && <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-[var(--color-gold)]">{e.tier}</p>}
                <p className="mt-1 text-xs text-[var(--color-stone)]">{e.totalPoints.toLocaleString('en-GB')} pts</p>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
