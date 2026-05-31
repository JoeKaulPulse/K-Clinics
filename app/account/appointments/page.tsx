export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { crmEnabled } from '@/lib/crm';
import { pt } from '@/lib/i18n-portal';
import type { Locale } from '@/lib/i18n';

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
  CANCELLED: 'bg-[var(--color-blush)]/20 text-[var(--color-ink)]',
  NO_SHOW: 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]',
};

export default async function AppointmentsPage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getDashboard } = await import('@/lib/portal-data');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const { upcoming, past } = await getDashboard(client.id);

  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';
  const t = (k: string, v?: Record<string, string | number>) => pt(locale, k, v);
  const lc = locale === 'uk' ? 'uk-UA' : 'en-GB';
  const dayCount = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 864e5);

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{t('nav.appointments')}</p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">{t('appt.title')}</h1>
        </div>
        <Link href="/book" className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">{t('appt.bookNew')}</Link>
      </div>

      <h2 className="eyebrow mb-3">{t('appt.upcoming')}</h2>
      {upcoming.length ? (
        <ul className="mb-10 grid gap-3">
          {upcoming.map((b) => {
            const days = dayCount(b.startAt);
            const when = days <= 0 ? t('dash.today') : days === 1 ? t('dash.tomorrow') : t('dash.inDays', { n: days });
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-4">
                  {/* Date chip */}
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-ink)] text-[var(--color-porcelain)]">
                    <span className="font-[family-name:var(--font-display)] text-lg leading-none">{b.startAt.getDate()}</span>
                    <span className="text-[0.6rem] uppercase tracking-wide">{b.startAt.toLocaleDateString(lc, { month: 'short' })}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-[family-name:var(--font-display)] text-lg">{b.treatmentTitle}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${STATUS_STYLE[b.status] || ''}`}>{t(`status.${b.status}`)}</span>
                    </div>
                    <p className="text-sm text-[var(--color-stone)]">
                      {b.startAt.toLocaleDateString(lc, { weekday: 'long', day: 'numeric', month: 'long' })} · {b.startAt.toLocaleTimeString(lc, { hour: '2-digit', minute: '2-digit' })}
                      <span className="ml-2 text-[var(--color-gold)]">· {when}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/api/account/calendar/${b.manageToken}`} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
                    {t('appt.addCalendar')}
                  </a>
                  <Link href={`/booking/manage?token=${b.manageToken}`} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
                    {t('appt.reschedule')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-10 text-[var(--color-stone)]">{t('appt.none')} <Link href="/book" className="font-medium text-[var(--color-gold)]">{t('appt.bookNow')} →</Link></p>
      )}

      <h2 className="eyebrow mb-3">{t('appt.past')}</h2>
      {past.length ? (
        <ul className="grid gap-2">
          {past.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-line)] px-5 py-3 text-sm">
              <span className="flex items-center gap-2">
                {b.treatmentTitle}
                <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${STATUS_STYLE[b.status] || ''}`}>{t(`status.${b.status}`)}</span>
              </span>
              <span className="text-[var(--color-stone)]">{b.startAt.toLocaleDateString(lc, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--color-stone)]">{t('appt.noPast')}</p>
      )}
    </PortalShell>
  );
}
