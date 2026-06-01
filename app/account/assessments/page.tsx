export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { crmEnabled } from '@/lib/crm';
import { portalAssessments } from '@/lib/questionnaires';
import { localizeQuestionnaire } from '@/lib/questionnaires-uk';
import { pt } from '@/lib/i18n-portal';
import type { Locale } from '@/lib/i18n';

export default async function AssessmentsPage() {
  if (!crmEnabled) redirect('/account');

  const { getCurrentClient } = await import('@/lib/client-auth');
  const { assessmentStatus } = await import('@/lib/health-assessments');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const statuses = await assessmentStatus(client.id);
  const { getSetting } = await import('@/lib/settings');
  const hideSigned = await getSetting('hide_signed_forms');

  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';
  const t = (k: string, v?: Record<string, string | number>) => pt(locale, k, v);
  const lc = locale === 'uk' ? 'uk-UA' : 'en-GB';
  const doneCount = portalAssessments.filter((q) => statuses.get(q.type)).length;
  const total = portalAssessments.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <div className="mb-8">
        <p className="eyebrow mb-2 inline-flex items-center gap-2.5"><span className="h-px w-7 bg-[var(--color-gold)]/60" />{t('asmt.eyebrow')}</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">{t('asmt.title')}</h1>
        <p className="mt-2 max-w-xl text-[var(--color-stone)]">{t('asmt.intro')}</p>
      </div>

      {/* Progress band */}
      <div className="mb-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{t('asmt.progress', { done: doneCount, total })}</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-stone)]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[var(--color-gold)]" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" strokeLinejoin="round" /></svg>
            {t('asmt.secure')}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-bone)]">
          <div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        {doneCount === total && <p className="mt-3 text-sm text-[var(--color-jade)]">{t('asmt.allDone')}</p>}
      </div>

      <div className="grid gap-4">
        {portalAssessments.map((q) => {
          const done = statuses.get(q.type);
          const lq = localizeQuestionnaire(q, locale);
          return (
            <div key={q.key} className="group flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-gold)]/40 hover:shadow-[var(--shadow-lift)]">
              <div className="flex items-start gap-4">
                <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full ${done ? 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' : 'bg-[var(--color-gold)]/15 text-[var(--color-gold)]'}`}>
                  {done ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 12h6M9 16h6M9 8h6M5 4h14v16H5z" strokeLinejoin="round" /></svg>
                  )}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-[family-name:var(--font-display)] text-xl">{lq.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${done ? 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>
                      {done ? t('asmt.done') : t('asmt.todo')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-stone)]">
                    {done ? t('asmt.completedOn', { date: done.submittedAt.toLocaleDateString(lc, { day: 'numeric', month: 'short', year: 'numeric' }) }) : t('asmt.about', { n: q.estMinutes })}
                  </p>
                </div>
              </div>
              {done && hideSigned ? (
                <span className="shrink-0 rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium text-[var(--color-stone)]">{t('asmt.onFile')}</span>
              ) : (
                <Link
                  href={`/account/assessments/${q.key}`}
                  className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${done ? 'border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]' : 'bg-[var(--color-gold)] text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)]'}`}
                >
                  {done ? t('asmt.update') : t('asmt.start')}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </PortalShell>
  );
}
