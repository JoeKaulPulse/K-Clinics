export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { DashboardHero } from '@/components/portal/DashboardHero';
import { ScrollReveal } from '@/components/motion/ScrollReveal';
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
        <ScrollReveal>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-gradient-to-br from-[var(--color-bone)] to-[var(--color-sand)]/50 p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/15 text-[var(--color-gold)]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7C12 7 12 2 8.5 2S5 7 12 7zM12 7s0-5 3.5-5S19 7 12 7z" strokeLinejoin="round" /></svg>
              </span>
              <div>
                <p className="font-medium">{t('dash.offerReady')}</p>
                <p className="text-sm text-[var(--color-stone)]">
                  {t('dash.offerBody', { percent: data.discount.percent, code: '' })}
                  <span className="font-mono font-semibold text-[var(--color-gold)]">{data.discount.code}</span>
                </p>
              </div>
            </div>
            <Link href="/book" className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)]">
              {t('dash.book')}
            </Link>
          </div>
        </ScrollReveal>
      )}

      {missingProfile && (
        <ScrollReveal>
          <Link href="/account/profile" className="group mb-8 flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 transition-colors hover:border-[var(--color-gold)]">
            <div>
              <p className="text-sm font-medium">{t('dash.profilePrompt')}</p>
              <p className="text-sm text-[var(--color-stone)]">{t('dash.profileBody')}</p>
            </div>
            <span className="shrink-0 text-sm font-medium text-[var(--color-gold)] transition-transform group-hover:translate-x-0.5">{t('dash.updateProfile')} →</span>
          </Link>
        </ScrollReveal>
      )}

      <ScrollReveal delay={0.05}>
        <div className="grid gap-5 md:grid-cols-2">
          {/* Health forms */}
          <Card title={t('dash.healthForms')}>
            {outstanding.length ? (
              <ul className="space-y-3">
                {outstanding.map((q) => {
                  const lq = localizeQuestionnaire(q, locale);
                  return (
                    <li key={q.key} className="flex items-center justify-between gap-3">
                      <span>{lq.title}</span>
                      <Link href={`/account/assessments/${q.key}`} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)]">
                        {t('dash.complete')} · {q.estMinutes} {t('dash.min')}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty text={t('dash.formsComplete')} done />
            )}
          </Card>

          {/* Recent payments */}
          <Card title={t('dash.payments')} href="/account/invoices" linkLabel={`${t('dash.allPayments')} →`}>
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
          </Card>

          {/* Book another */}
          <Card title={t('dash.bookAnother')}>
            <p className="text-[var(--color-stone)]">{t('dash.bookAnotherBody')}</p>
            <Link href="/treatments" className="mt-4 inline-block rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
              {t('dash.explore')}
            </Link>
          </Card>

          {/* Treatment history (in-card timeline) */}
          {completed.length > 0 && (
            <Card title={t('dash.history')}>
              <ol className="relative space-y-3.5 border-l border-[var(--color-line)] pl-5">
                {completed.slice(0, 4).map((b) => (
                  <li key={b.id} className="relative">
                    <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-gold)]" />
                    <p className="text-sm font-medium">{b.treatmentTitle}</p>
                    <p className="text-xs text-[var(--color-stone)]">{dateFmt(b.startAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </ScrollReveal>
    </PortalShell>
  );
}

function Card({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="group flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-gold)]/40">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px w-6 bg-[var(--color-gold)]" />
        <h2 className="eyebrow">{title}</h2>
      </div>
      <div className="flex-1">{children}</div>
      {href && linkLabel && (
        <Link href={href} className="mt-4 inline-block text-sm font-medium text-[var(--color-gold)]">{linkLabel}</Link>
      )}
    </section>
  );
}

function Empty({ text, done }: { text: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[var(--color-stone)]">
      {done && (
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--color-jade)]/15 text-[var(--color-jade)]">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
      <p>{text}</p>
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
