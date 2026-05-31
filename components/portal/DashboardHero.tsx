'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { portalTranslator, type Locale } from '@/lib/i18n-portal';

type Next = { treatmentTitle: string; startISO: string } | null;

export function DashboardHero({ firstName, locale, next, visits, memberSince, lastVisitISO }: {
  firstName: string; locale: Locale; next: Next; visits: number; memberSince: string; lastVisitISO: string | null;
}) {
  const t = portalTranslator(locale);
  const hour = new Date().getHours();
  const greetKey = hour < 12 ? 'dash.goodMorning' : hour < 18 ? 'dash.goodAfternoon' : 'dash.goodEvening';
  const dateFmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', opts);

  let countdown = '';
  if (next) {
    const days = Math.ceil((new Date(next.startISO).getTime() - Date.now()) / 864e5);
    countdown = days <= 0 ? t('dash.today') : days === 1 ? t('dash.tomorrow') : t('dash.inDays', { n: days });
  }

  return (
    <div className="mb-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <p className="eyebrow mb-2">{t('dash.eyebrow')}</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+2vw,3rem)] leading-tight">{t(greetKey, { name: firstName })}</h1>
      </motion.div>

      {/* Next appointment feature card */}
      {next && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-7 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-ink)] p-7 text-[var(--color-porcelain)]"
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_15%,color-mix(in_oklab,var(--color-gold)_30%,transparent),transparent_55%)]" />
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-gold-soft)]">{t('dash.nextAppt')} · {countdown}</p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-3xl">{next.treatmentTitle}</p>
              <p className="mt-1 text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">
                {dateFmt(next.startISO, { weekday: 'long', day: 'numeric', month: 'long' })} · {new Date(next.startISO).toLocaleTimeString(locale === 'uk' ? 'uk-UA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Link href="/account/appointments" className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--color-ink)]">
              {t('dash.manage')} →
            </Link>
          </div>
        </motion.div>
      )}

      {/* Stat band */}
      {(visits > 0 || lastVisitISO) && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.5 }}
          className="mt-5 grid grid-cols-3 gap-3"
        >
          <Stat label={t('dash.statVisits')} value={String(visits)} />
          <Stat label={t('dash.statSince')} value={dateFmt(memberSince, { month: 'short', year: 'numeric' })} />
          <Stat label={t('dash.statLast')} value={lastVisitISO ? dateFmt(lastVisitISO, { day: 'numeric', month: 'short' }) : '—'} />
        </motion.div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-center">
      <div className="font-[family-name:var(--font-display)] text-xl">{value}</div>
      <div className="mt-0.5 text-[0.7rem] uppercase tracking-[0.12em] text-[var(--color-stone)]">{label}</div>
    </div>
  );
}
