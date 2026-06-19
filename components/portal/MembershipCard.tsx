import type { MembershipStatus } from '@/lib/membership';
import type { Locale } from '@/lib/i18n';
import { AnimatedBar } from '@/components/portal/AnimatedBar';

const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

// Client-facing K Circle status: current tier, perks, and progress to the next.
export function MembershipCard({ status, locale }: { status: MembershipStatus; locale: Locale }) {
  const uk = locale === 'uk';
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const { tier, spendPence, next, toNextPence, progressPct, multiplierBps } = status;
  const accent = tier.color || 'var(--color-gold)';
  const multiplier = (multiplierBps / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 });

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5" style={{ background: `linear-gradient(110% 120% at 90% 0%, color-mix(in oklab, ${accent} 22%, transparent), transparent 60%)` }}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: accent }}>{tier.name.charAt(0)}</span>
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-[var(--color-stone-soft)]">{L('K Circle membership', 'Членство K Circle')}</p>
            <p className="font-[family-name:var(--font-display)] text-2xl leading-tight">{tier.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-xl" style={{ color: accent }}>{multiplier}× {L('points', 'балів')}</p>
          <p className="text-xs text-[var(--color-stone-soft)]">{L('on every visit', 'за кожен візит')}</p>
        </div>
      </div>

      <div className="px-6 py-5">
        {next ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-stone)]">{L('Progress to', 'До рівня')} <strong className="text-[var(--color-ink)]">{next.name}</strong></span>
              <span className="font-medium">{gbp(toNextPence)} {L('to go', 'залишилось')}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--color-bone)]">
              <AnimatedBar pct={progressPct} color={accent} className="h-full rounded-full" />
            </div>
            <p className="mt-2 text-xs text-[var(--color-stone-soft)]">{L('Based on', 'На основі')} {gbp(spendPence)} {L('spent in the last 12 months. Tiers refresh on a rolling basis.', 'витрачено за останні 12 місяців. Рівні оновлюються щомісяця.')}</p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-stone)]">{L('You’re at our top tier — thank you for being one of our most valued members.', 'Ви на найвищому рівні — дякуємо, що ви один із наших найцінніших клієнтів.')} <span className="text-[var(--color-stone-soft)]">({gbp(spendPence)} {L('in 12 months', 'за 12 місяців')})</span></p>
        )}

        {tier.perks.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {tier.perks.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-[var(--color-stone)]">
                <span aria-hidden style={{ color: accent }}>✦</span>{p}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
