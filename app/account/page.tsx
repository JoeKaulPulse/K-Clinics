export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { DashboardHero } from '@/components/portal/DashboardHero';
import { crmEnabled } from '@/lib/crm';
import { formatPrice } from '@/lib/treatments';
import { portalAssessments } from '@/lib/questionnaires';
import { localizeQuestionnaire } from '@/lib/questionnaires-uk';
import { pt } from '@/lib/i18n-portal';
import type { Locale } from '@/lib/i18n';

export default async function DashboardPage() {
  if (!crmEnabled) return <NotEnabled />;

  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getDashboard } = await import('@/lib/portal-data');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const data = await getDashboard(client.id);

  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';
  const t = (k: string, v?: Record<string, string | number>) => pt(locale, k, v);
  const next = data.upcoming[0];
  const outstanding = portalAssessments.filter((q) => !data.assessments[q.type]);
  const completed = data.past.filter((b) => b.status === 'COMPLETED');
  const dateFmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', opts);

  // Profile completeness nudge — show when key fields are missing.
  const missingProfile = !client.phone || !client.dob;

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <DashboardHero
        firstName={client.firstName}
        locale={locale}
        next={next ? { treatmentTitle: next.treatmentTitle, startISO: next.startAt.toISOString() } : null}
        visits={completed.length}
        memberSince={client.createdAt.toISOString()}
        lastVisitISO={client.lastVisitAt ? client.lastVisitAt.toISOString() : null}
      />

      {data.discount && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] p-6">
          <div>
            <p className="font-medium">{t('dash.offerReady')}</p>
            <p className="text-sm text-[var(--color-stone)]">
              {t('dash.offerBody', { percent: data.discount.percent, code: '' })}
              <span className="font-mono font-semibold text-[var(--color-gold)]">{data.discount.code}</span>
            </p>
          </div>
          <Link href="/book" className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-ink)]">
            {t('dash.book')}
          </Link>
        </div>
      )}

      {missingProfile && (
        <Link href="/account/profile" className="mb-8 flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 transition-colors hover:border-[var(--color-gold)]">
          <div>
            <p className="text-sm font-medium">{t('dash.profilePrompt')}</p>
            <p className="text-sm text-[var(--color-stone)]">{t('dash.profileBody')}</p>
          </div>
          <span className="shrink-0 text-sm font-medium text-[var(--color-gold)]">{t('dash.updateProfile')} →</span>
        </Link>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {/* Next appointment (compact) only when the hero feature isn't shown */}
        {!next && (
          <Card title={t('dash.nextAppt')}>
            <Empty text={t('dash.noUpcoming')} cta={{ href: '/book', label: t('dash.bookNow') }} />
          </Card>
        )}

        {/* Health forms */}
        <Card title={t('dash.healthForms')}>
          {outstanding.length ? (
            <ul className="space-y-3">
              {outstanding.map((q) => {
                const lq = localizeQuestionnaire(q, locale);
                return (
                  <li key={q.key} className="flex items-center justify-between gap-3">
                    <span>{lq.title}</span>
                    <Link href={`/account/assessments/${q.key}`} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)]">
                      {t('dash.complete')} · {q.estMinutes} {t('dash.min')}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty text={t('dash.formsComplete')} />
          )}
        </Card>

        {/* Recent payments */}
        <Card title={t('dash.payments')}>
          {data.invoices.length ? (
            <ul className="divide-y divide-[var(--color-line)]">
              {data.invoices.slice(0, 3).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{inv.title}</span>
                  <span className="font-medium">{formatPrice(inv.amountPence)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={t('dash.noPayments')} />
          )}
          <Link href="/account/invoices" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold)]">
            {t('dash.allPayments')} →
          </Link>
        </Card>

        {/* Book more */}
        <Card title={t('dash.bookAnother')}>
          <p className="text-[var(--color-stone)]">{t('dash.bookAnotherBody')}</p>
          <Link href="/treatments" className="mt-4 inline-block rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
            {t('dash.explore')}
          </Link>
        </Card>
      </div>

      {/* Treatment history timeline */}
      {completed.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow mb-4">{t('dash.history')}</h2>
          <ol className="relative space-y-4 border-l border-[var(--color-line)] pl-5">
            {completed.slice(0, 6).map((b) => (
              <li key={b.id} className="relative">
                <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-gold)]" />
                <p className="text-sm font-medium">{b.treatmentTitle}</p>
                <p className="text-xs text-[var(--color-stone)]">{dateFmt(b.startAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </PortalShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]">
      <h2 className="eyebrow mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="text-[var(--color-stone)]">
      <p>{text}</p>
      {cta && (
        <Link href={cta.href} className="mt-3 inline-block text-sm font-medium text-[var(--color-gold)]">
          {cta.label} →
        </Link>
      )}
    </div>
  );
}

function NotEnabled() {
  return (
    <div className="mx-auto grid min-h-screen max-w-md place-items-center px-6 text-center">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl">Client portal</h1>
        <p className="mt-3 text-[var(--color-stone)]">
          The secure portal runs on the live environment (server + database). It isn’t available in this static preview.
        </p>
      </div>
    </div>
  );
}
