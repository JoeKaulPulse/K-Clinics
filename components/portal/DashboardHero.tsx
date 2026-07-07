'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { portalTranslator, type Locale } from '@/lib/i18n-portal';

type Next = { treatmentTitle: string; startISO: string } | null;

const ease = [0.16, 1, 0.3, 1] as const;

export function DashboardHero({ firstName, locale, next, visits, memberSince, lastVisitISO }: {
  firstName: string; locale: Locale; next: Next; visits: number; memberSince: string; lastVisitISO: string | null;
}) {
  const t = portalTranslator(locale);
  const hour = new Date().getHours();
  const greetKey = hour < 12 ? 'dash.goodMorning' : hour < 18 ? 'dash.goodAfternoon' : 'dash.goodEvening';
  // Split the greeting so the name renders as a Fraunces italic gold accent.
  const greeting = t(greetKey, { name: '<<<' });
  const [greetLead, greetTail] = greeting.split('<<<');
  const lc = locale === 'uk' ? 'uk-UA' : 'en-GB';
  // Clinic-local (Europe/London) so the portal matches the confirmation email and
  // the clinic diary regardless of the viewing device's timezone (BLD-795).
  const dateFmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString(lc, { timeZone: 'Europe/London', ...opts });

  let countdown = '';
  if (next) {
    const days = Math.ceil((new Date(next.startISO).getTime() - Date.now()) / 864e5);
    countdown = days <= 0 ? t('dash.today') : days === 1 ? t('dash.tomorrow') : t('dash.inDays', { n: days });
  }

  const stats = [
    { label: t('dash.statVisits'), value: String(visits) },
    { label: t('dash.statSince'), value: dateFmt(memberSince, { month: 'short', year: 'numeric' }) },
    { label: t('dash.statLast'), value: lastVisitISO ? dateFmt(lastVisitISO, { day: 'numeric', month: 'short' }) : '—' },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }}
      className="relative mb-10 overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-ink)] text-[var(--color-porcelain)]"
    >
      {/* Layered radial glows — the marketing-hero treatment. */}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute inset-0 bg-[radial-gradient(110%_120%_at_88%_8%,color-mix(in_oklab,var(--color-gold)_32%,transparent),transparent_56%)]" />
        <span className="absolute inset-0 bg-[radial-gradient(90%_90%_at_8%_98%,color-mix(in_oklab,var(--color-blush)_20%,transparent),transparent_60%)]" />
      </span>

      <div className="relative z-10 p-8 sm:p-10 lg:p-12">
        <p className="eyebrow text-[var(--color-gold-soft)]">{t('dash.eyebrow')}</p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2.1rem,1.5rem+2.6vw,3.4rem)] leading-[1.02] tracking-[-0.01em]">
          {greetLead}
          <span className="italic text-[var(--color-gold-soft)]">{firstName}</span>
          {greetTail}
        </h1>

        {next ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.6, ease }}
            className="mt-9 flex flex-wrap items-end justify-between gap-6 border-t border-white/12 pt-8"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[color-mix(in_oklab,var(--color-porcelain)_64%,transparent)]">{t('dash.nextAppt')} · {countdown}</p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.4vw,2.4rem)] leading-tight">{next.treatmentTitle}</p>
              <p className="mt-1.5 text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">
                {dateFmt(next.startISO, { weekday: 'long', day: 'numeric', month: 'long' })} · {new Date(next.startISO).toLocaleTimeString(lc, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
              </p>
            </div>
            <Link href="/account/appointments" className="rounded-full bg-[var(--color-gold)] px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-white hover:text-[var(--color-ink)]">
              {t('dash.manage')} →
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.6, ease }}
            className="mt-9 flex flex-wrap items-center justify-between gap-6 border-t border-white/12 pt-8"
          >
            <p className="max-w-md text-[color-mix(in_oklab,var(--color-porcelain)_80%,transparent)]">{t('dash.noUpcoming')}</p>
            <Link href="/book" className="rounded-full bg-[var(--color-gold)] px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-white hover:text-[var(--color-ink)]">
              {t('dash.bookNow')} →
            </Link>
          </motion.div>
        )}

        {/* Stat band — marketing-hero dl treatment. */}
        {(visits > 0 || lastVisitISO) && (
          <motion.dl
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6, ease }}
            className="mt-10 grid grid-cols-3 gap-6 border-t border-white/12 pt-8"
          >
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-gold-soft)] sm:text-3xl">{s.value}</dt>
                <dd className="mt-1 text-[0.7rem] uppercase tracking-[0.14em] text-[color-mix(in_oklab,var(--color-porcelain)_62%,transparent)]">{s.label}</dd>
              </div>
            ))}
          </motion.dl>
        )}
      </div>
    </motion.section>
  );
}
