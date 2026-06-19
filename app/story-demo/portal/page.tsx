// THROWAWAY preview/capture route for the client-portal enhancement work.
// Renders the real portal shell + components with mock data so the logged-in
// portal can be seen and filmed without auth or a database. Not linked anywhere.
import { PortalShell } from '@/components/portal/PortalShell';
import { DashboardHero } from '@/components/portal/DashboardHero';
import { MembershipCard } from '@/components/portal/MembershipCard';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';
import { Tilt } from '@/components/motion/Tilt';
import type { MembershipStatus } from '@/lib/membership';

export const dynamic = 'force-static';

const goldTier = {
  key: 'gold', name: 'Gold', minSpendPence: 150000, pointsMultiplierBps: 150,
  birthdayBonusPoints: 500, earlyAccessHours: 48, retailDiscountPct: 10,
  perks: ['Priority booking windows', '1.5× points on every visit', 'Complimentary skin review', 'Birthday gift'],
  color: '#a98a6d', sortOrder: 2,
};
const platinumTier = { ...goldTier, key: 'platinum', name: 'Platinum', minSpendPence: 300000, color: '#7d6259', sortOrder: 3 };
const membership: MembershipStatus = {
  tier: goldTier, spendPence: 214000, next: platinumTier, toNextPence: 86000, progressPct: 71, multiplierBps: 150,
};

const featured = [
  { name: 'HydraGlow Facial', cat: 'Skin', price: 'From £85', g: 'from-[#cdb4a3] to-[#7d6259]' },
  { name: 'SMAS HIFU Lifting', cat: 'Skin', price: 'From £450', g: 'from-[#c2a589] to-[#4a3f37]' },
  { name: 'Laser Hair Removal', cat: 'Laser', price: 'From £60', g: 'from-[#b7a294] to-[#2a2420]' },
];
const nextStart = new Date(Date.now() + 3 * 864e5);
nextStart.setHours(14, 30, 0, 0);

const card = 'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]';
const clickable = 'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-gold)]/40 hover:shadow-[var(--shadow-lift)]';

export default function PortalPreview() {
  return (
    <PortalShell firstName="Sofia" locale="en" activePath="/account">
      <DashboardHero
        firstName="Sofia" locale="en"
        next={{ treatmentTitle: 'HydraGlow Facial — Signature', startISO: nextStart.toISOString() }}
        visits={12} memberSince={new Date(2026, 0, 14).toISOString()} lastVisitISO={new Date(2026, 4, 30).toISOString()}
      />

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8">
          {/* points card */}
          <Reveal>
            <div className={`mb-6 flex flex-wrap items-center justify-between gap-4 ${card} ${clickable}`}>
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-gold)]/15 text-lg text-[var(--color-gold)]">★</span>
                <div>
                  <p className="font-[family-name:var(--font-display)] text-2xl"><CountUp value="2480" /> points</p>
                  <p className="text-sm text-[var(--color-stone)]">Worth £24 off your next visit</p>
                </div>
              </div>
              <span className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)] active:scale-[0.97]">Redeem →</span>
            </div>
          </Reveal>

          {/* membership */}
          <Reveal delay={0.04}><div className="mb-6"><MembershipCard status={membership} locale="en" /></div></Reveal>

          {/* two-col cards */}
          <Stagger className="grid gap-6 sm:grid-cols-2" gap={0.08}>
            <StaggerItem>
              <div className={`${card} ${clickable} h-full`}>
                <p className="eyebrow mb-3 inline-flex items-center gap-2.5"><span className="h-px w-7 bg-[var(--color-gold)]/60" />Health forms</p>
                <h2 className="font-[family-name:var(--font-display)] text-xl">Ready for your visit</h2>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {['Medical history', 'Consent — facial', 'Skin questionnaire'].map((f) => (
                    <li key={f} className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] pb-2.5 last:border-0">
                      <span className="text-[var(--color-ink-soft)]">{f}</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-jade)]/12 px-2.5 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide text-[var(--color-jade)]">✓ Done</span>
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className={`${card} ${clickable} h-full`}>
                <p className="eyebrow mb-3 inline-flex items-center gap-2.5"><span className="h-px w-7 bg-[var(--color-gold)]/60" />Payments</p>
                <h2 className="font-[family-name:var(--font-display)] text-xl">Recent invoices</h2>
                <ul className="mt-4 divide-y divide-[var(--color-line)] text-sm">
                  {[['HydraGlow Facial', '£102'], ['Laser — underarms', '£60'], ['SMAS HIFU', '£450']].map(([n, p]) => (
                    <li key={n} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-[var(--color-ink-soft)]">{n}</span>
                      <span className="font-[family-name:var(--font-display)] text-base">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          </Stagger>
        </div>

        {/* rail */}
        <div className="lg:col-span-4 lg:sticky lg:top-28">
          <Reveal delay={0.1}>
            <div className={card}>
              <p className="eyebrow mb-4 inline-flex items-center gap-2.5"><span className="h-px w-7 bg-[var(--color-gold)]/60" />Quick actions</p>
              <div className="grid gap-2">
                {[['Book a visit', true], ['Manage appointments', false], ['Download invoices', false], ['Update details', false]].map(([label, primary]) => (
                  <span key={label as string} className={`rounded-[var(--radius-sm)] px-3 py-2.5 text-sm transition-colors active:scale-[0.98] ${primary ? 'bg-[var(--color-ink)] font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-gold)]' : 'hover:bg-[var(--color-bone)]'}`}>{label}</span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* treatments */}
      <section className="mt-16">
        <Reveal>
          <p className="eyebrow mb-3 inline-flex items-center gap-2.5"><span className="h-px w-7 bg-[var(--color-gold)]/60" />For you</p>
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.4vw,2.3rem)]">Recommended treatments</h2>
        </Reveal>
        <Stagger className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" gap={0.09}>
          {featured.map((tr) => (
            <StaggerItem key={tr.name}>
              <Tilt max={6}>
                <div className={`group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-200 hover:shadow-[var(--shadow-lift)]`}>
                  <div className={`relative h-44 bg-gradient-to-br ${tr.g}`}>
                    <span className="absolute left-4 top-4 rounded-full bg-black/20 px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-white backdrop-blur-sm">{tr.cat}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-5">
                    <div>
                      <h3 className="font-[family-name:var(--font-display)] text-lg leading-tight">{tr.name}</h3>
                      <p className="mt-1 text-sm text-[var(--color-stone)]">{tr.price}</p>
                    </div>
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-line)] text-[var(--color-gold)] transition-colors group-hover:border-[var(--color-gold)] group-hover:bg-[var(--color-gold)] group-hover:text-white">→</span>
                  </div>
                </div>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </PortalShell>
  );
}
