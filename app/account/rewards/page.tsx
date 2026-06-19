export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { Glyph } from '@/components/ui/Glyph';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ReferralCard } from '@/components/portal/ReferralCard';
import { MembershipCard } from '@/components/portal/MembershipCard';
import { Reveal } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';
import { KMark } from '@/components/brand/marks';
import { crmEnabled } from '@/lib/crm';
import { formatPrice } from '@/lib/treatments';
import { site } from '@/lib/site';
import { pt } from '@/lib/i18n-portal';
import type { Locale } from '@/lib/i18n';

const CAT_LABEL: Record<string, { en: string; uk: string }> = {
  SPEND: { en: 'Treatment spend', uk: 'Витрати на процедури' },
  REVIEW: { en: 'Review', uk: 'Відгук' },
  BIRTHDAY: { en: 'Birthday gift', uk: 'Подарунок на день народження' },
  REFERRAL: { en: 'Referral', uk: 'Реферал' },
  REDEMPTION: { en: 'Redeemed', uk: 'Використано' },
  EXPIRY: { en: 'Expired', uk: 'Спливли' },
  MANUAL: { en: 'Adjustment', uk: 'Коригування' },
};

export default async function RewardsPage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');

  const { clientLoyaltySummary, clientLedger, getOrCreateReferralCode } = await import('@/lib/client-loyalty');
  const { clientMembership } = await import('@/lib/membership');
  const [summary, ledger, code, membership] = await Promise.all([
    clientLoyaltySummary(client.id),
    clientLedger(client.id, 25),
    getOrCreateReferralCode(client.id),
    clientMembership(client.id),
  ]);

  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';
  const t = (k: string, v?: Record<string, string | number>) => pt(locale, k, v);
  const lc = locale === 'uk' ? 'uk-UA' : 'en-GB';
  const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url || '').replace(/\/$/, '');
  const link = `${base}/account/signup?ref=${encodeURIComponent(code)}`;
  const { qrSvg } = await import('@/lib/qr');
  const referralQr = await qrSvg(link, { dark: '#1a1a1a' });

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <PortalPageHeader eyebrow={t('nav.rewards')} title={t('rw.title')} subtitle={t('rw.sub')} />

      {/* K Circle membership status */}
      <Reveal>
        <div className="mb-5"><MembershipCard status={membership} locale={locale} /></div>
      </Reveal>

      {/* Balance — premium membership card */}
      <Reveal>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-[var(--color-ink)] p-7 text-[var(--color-porcelain)] shadow-[var(--shadow-lift)]">
          <span aria-hidden className="pointer-events-none absolute inset-0">
            <span className="absolute inset-0 bg-[radial-gradient(115%_120%_at_88%_4%,color-mix(in_oklab,var(--color-gold)_36%,transparent),transparent_58%)]" />
            <span className="absolute -bottom-14 -right-10 h-48 w-48 text-[var(--color-gold)] opacity-[0.12]"><KMark animated /></span>
          </span>
          <div className="relative z-10">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[var(--color-porcelain)]/60">{t('rw.balance')}</p>
            <p className="mt-3 font-[family-name:var(--font-display)] text-[clamp(2.8rem,2rem+3vw,4rem)] leading-none text-[var(--color-gold-soft)]"><CountUp value={String(summary.balance)} /></p>
            <p className="mt-2 text-sm text-[var(--color-porcelain)]/75">{t('rw.points')} · {t('rw.worth', { value: formatPrice(summary.valuePence) })}</p>
          </div>
          {summary.expiringSoon > 0 && (
            <p className="relative z-10 mt-4 inline-block self-start rounded-full bg-[var(--color-porcelain)]/10 px-3 py-1 text-xs text-[var(--color-gold-soft)] backdrop-blur-sm">{t('rw.expiringSoon', { n: summary.expiringSoon })}</p>
          )}
        </div>

        {/* How to earn */}
        <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 text-sm font-medium">{t('rw.howTitle')}</h2>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {[
              { icon: '£', text: t('rw.howSpend') },
              { icon: '★', text: t('rw.howReview') },
              { icon: <Glyph name="cake" className="h-3.5 w-3.5" />, text: t('rw.howBirthday') },
              { icon: <Glyph name="gift" className="h-3.5 w-3.5" />, text: t('rw.howReferral') },
            ].map((row) => (
              <li key={row.text} className="flex items-start gap-2.5 text-sm text-[var(--color-stone)]">
                <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/12 text-xs text-[var(--color-gold)]">{row.icon}</span>
                {row.text}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-stone-soft)]">{t('rw.redeemNote')}</p>
        </div>
      </div>
      </Reveal>

      {/* Referral */}
      <Reveal delay={0.06}>
      <div className="mt-5">
        <ReferralCard
          link={link}
          qrSvg={referralQr}
          labels={{
            title: t('rw.referTitle'), sub: t('rw.referSub'), yourLink: t('rw.yourLink'),
            copy: t('rw.copy'), copied: t('rw.copied'), share: t('rw.share'), shareText: t('rw.shareText'),
            stats: t('rw.referStats', { qualified: summary.referralsQualified, pending: summary.referralsPending }),
            qrShow: t('rw.qrShow'), qrHide: t('rw.qrHide'), qrHint: t('rw.qrHint'),
          }}
        />
      </div>
      </Reveal>

      {/* Activity */}
      <h2 className="eyebrow mb-3 mt-10">{t('rw.activity')}</h2>
      {ledger.length ? (
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
          {ledger.map((row, i) => (
            <Reveal as="li" key={row.id} delay={Math.min(i * 0.04, 0.4)} className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-[var(--color-bone)]/30">
              <span className="min-w-0">
                <span className="block truncate">{row.reason}</span>
                <span className="text-xs text-[var(--color-stone-soft)]">
                  {row.createdAt.toLocaleDateString(lc, { day: 'numeric', month: 'short', year: 'numeric' })} · {CAT_LABEL[row.category]?.[locale] || row.category}
                </span>
              </span>
              <span className={`shrink-0 font-medium ${row.points < 0 ? 'text-[var(--color-stone)]' : 'text-[var(--color-jade)]'}`}>{row.points > 0 ? '+' : ''}{row.points.toLocaleString(lc)}</span>
            </Reveal>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--color-stone)]">{t('rw.noActivity')} <Link href="/book" className="font-medium text-[var(--color-gold)]">{t('appt.bookNow')} →</Link></p>
      )}
    </PortalShell>
  );
}
