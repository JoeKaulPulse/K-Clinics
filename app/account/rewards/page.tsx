export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { ReferralCard } from '@/components/portal/ReferralCard';
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
  const [summary, ledger, code] = await Promise.all([
    clientLoyaltySummary(client.id),
    clientLedger(client.id, 25),
    getOrCreateReferralCode(client.id),
  ]);

  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';
  const t = (k: string, v?: Record<string, string | number>) => pt(locale, k, v);
  const lc = locale === 'uk' ? 'uk-UA' : 'en-GB';
  const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url || '').replace(/\/$/, '');
  const link = `${base}/account/signup?ref=${encodeURIComponent(code)}`;

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <div className="mb-8">
        <p className="eyebrow mb-2">{t('nav.rewards')}</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">{t('rw.title')}</h1>
        <p className="mt-2 max-w-lg text-[var(--color-stone)]">{t('rw.sub')}</p>
      </div>

      {/* Balance */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-ink)] p-6 text-[var(--color-porcelain)]">
          <p className="text-xs uppercase tracking-wide text-[var(--color-porcelain)]/60">{t('rw.balance')}</p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-5xl text-[var(--color-gold-soft)]">{summary.balance.toLocaleString(lc)}</p>
          <p className="mt-1 text-sm text-[var(--color-porcelain)]/70">{t('rw.points')} · {t('rw.worth', { value: formatPrice(summary.valuePence) })}</p>
          {summary.expiringSoon > 0 && (
            <p className="mt-3 inline-block rounded-full bg-[var(--color-porcelain)]/10 px-3 py-1 text-xs text-[var(--color-gold-soft)]">{t('rw.expiringSoon', { n: summary.expiringSoon })}</p>
          )}
        </div>

        {/* How to earn */}
        <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <h2 className="mb-3 text-sm font-medium">{t('rw.howTitle')}</h2>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {[
              { icon: '£', text: t('rw.howSpend') },
              { icon: '★', text: t('rw.howReview') },
              { icon: '🎂', text: t('rw.howBirthday') },
              { icon: '🎁', text: t('rw.howReferral') },
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

      {/* Referral */}
      <div className="mt-5">
        <ReferralCard
          link={link}
          labels={{
            title: t('rw.referTitle'), sub: t('rw.referSub'), yourLink: t('rw.yourLink'),
            copy: t('rw.copy'), copied: t('rw.copied'), share: t('rw.share'), shareText: t('rw.shareText'),
            stats: t('rw.referStats', { qualified: summary.referralsQualified, pending: summary.referralsPending }),
          }}
        />
      </div>

      {/* Activity */}
      <h2 className="eyebrow mb-3 mt-10">{t('rw.activity')}</h2>
      {ledger.length ? (
        <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
          {ledger.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{row.reason}</span>
                <span className="text-xs text-[var(--color-stone-soft)]">
                  {row.createdAt.toLocaleDateString(lc, { day: 'numeric', month: 'short', year: 'numeric' })} · {CAT_LABEL[row.category]?.[locale] || row.category}
                </span>
              </span>
              <span className={`shrink-0 font-medium ${row.points < 0 ? 'text-[var(--color-stone)]' : 'text-[var(--color-jade)]'}`}>{row.points > 0 ? '+' : ''}{row.points.toLocaleString(lc)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--color-stone)]">{t('rw.noActivity')} <Link href="/book" className="font-medium text-[var(--color-gold)]">{t('appt.bookNow')} →</Link></p>
      )}
    </PortalShell>
  );
}
