// Preview/capture route — mirrors the enhanced rewards page with mock data.
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { MembershipCard } from '@/components/portal/MembershipCard';
import { Reveal } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';
import { KMark } from '@/components/brand/marks';
import type { MembershipStatus } from '@/lib/membership';

export const dynamic = 'force-static';

const goldTier = { key: 'gold', name: 'Gold', minSpendPence: 150000, pointsMultiplierBps: 150, birthdayBonusPoints: 500, earlyAccessHours: 48, retailDiscountPct: 10, perks: ['Priority booking windows', '1.5× points on every visit', 'Complimentary skin review', 'Birthday gift'], color: '#a98a6d', sortOrder: 2 };
const membership: MembershipStatus = { tier: goldTier, spendPence: 214000, next: { ...goldTier, key: 'platinum', name: 'Platinum', minSpendPence: 300000, color: '#7d6259', sortOrder: 3 }, toNextPence: 86000, progressPct: 71, multiplierBps: 150 };
const ledger = [
  { id: '1', reason: 'HydraGlow Facial — Signature', date: '30 May 2026', cat: 'Treatment spend', pts: 102 },
  { id: '2', reason: 'Left a review', date: '2 May 2026', cat: 'Review', pts: 150 },
  { id: '3', reason: 'Redeemed against invoice', date: '2 May 2026', cat: 'Redeemed', pts: -500 },
  { id: '4', reason: 'Friend referral — qualified', date: '18 Apr 2026', cat: 'Referral', pts: 750 },
];

export default function PreviewRewards() {
  return (
    <PortalShell firstName="Sofia" locale="en" activePath="/account/rewards">
      <PortalPageHeader eyebrow="Rewards" title="K Circle." subtitle="Earn points on every visit and unlock member perks." />
      <Reveal><div className="mb-5"><MembershipCard status={membership} locale="en" /></div></Reveal>
      <Reveal>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-[var(--color-ink)] p-7 text-[var(--color-porcelain)] shadow-[var(--shadow-lift)]">
            <span aria-hidden className="pointer-events-none absolute inset-0">
              <span className="absolute inset-0 bg-[radial-gradient(115%_120%_at_88%_4%,color-mix(in_oklab,var(--color-gold)_36%,transparent),transparent_58%)]" />
              <span className="absolute -bottom-14 -right-10 h-48 w-48 text-[var(--color-gold)] opacity-[0.12]"><KMark animated /></span>
            </span>
            <div className="relative z-10">
              <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[var(--color-porcelain)]/60">Points balance</p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2.8rem,2rem+3vw,4rem)] leading-none text-[var(--color-gold-soft)]"><CountUp value="2480" /></p>
              <p className="mt-2 text-sm text-[var(--color-porcelain)]/75">points · worth £24</p>
            </div>
            <p className="relative z-10 mt-4 inline-block self-start rounded-full bg-[var(--color-porcelain)]/10 px-3 py-1 text-xs text-[var(--color-gold-soft)] backdrop-blur-sm">120 expiring soon</p>
          </div>
          <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-3 text-sm font-medium">How to earn</h2>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {[['£', '1 point for every £1 spent'], ['★', '150 points for a review'], ['✦', 'Birthday bonus each year'], ['→', '750 points per referral']].map(([icon, text]) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-[var(--color-stone)]">
                  <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/12 text-xs text-[var(--color-gold)]">{icon}</span>{text}
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-stone-soft)]">100 points = £1 off any visit.</p>
          </div>
        </div>
      </Reveal>
      <h2 className="eyebrow mb-3 mt-10">Activity</h2>
      <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {ledger.map((row, i) => (
          <Reveal as="li" key={row.id} delay={Math.min(i * 0.05, 0.4)} className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-[var(--color-bone)]/30">
            <span className="min-w-0"><span className="block truncate">{row.reason}</span><span className="text-xs text-[var(--color-stone-soft)]">{row.date} · {row.cat}</span></span>
            <span className={`shrink-0 font-medium ${row.pts < 0 ? 'text-[var(--color-stone)]' : 'text-[var(--color-jade)]'}`}>{row.pts > 0 ? '+' : ''}{row.pts}</span>
          </Reveal>
        ))}
      </ul>
    </PortalShell>
  );
}
