export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { DashboardHero } from '@/components/portal/DashboardHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { DiscountChip } from '@/components/portal/DiscountChip';
import { OffersStrip } from '@/components/marketing/OffersStrip';
import { crmEnabled } from '@/lib/crm';
import { formatPrice, getTreatment, type Treatment } from '@/lib/treatments';
import { portalAssessments } from '@/lib/questionnaires';
import { localizeQuestionnaire } from '@/lib/questionnaires-uk';
import { pt } from '@/lib/i18n-portal';
import { site } from '@/lib/site';
import type { Locale } from '@/lib/i18n';

// Recommendation pool — includes gender-specific treatments which are filtered
// by the client's gender below (men's laser only shown to men, intimate
// rejuvenation only to women; everyone else sees the unisex set).
const FEATURED = ['hydraglow-facial', 'smas-hifu-lifting', 'laser-hair-removal', 'laser-hair-removal-for-men', 'intimate-rejuvenation', 'cosmetic-injections', 'veneers', 'body-contouring'];

export default async function DashboardPage() {
  if (!crmEnabled) return <NotEnabled />;

  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getDashboard } = await import('@/lib/portal-data');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const data = await getDashboard(client.id);
  const { clientLoyaltySummary } = await import('@/lib/client-loyalty');
  const { formatPrice } = await import('@/lib/treatments');
  const loyalty = await clientLoyaltySummary(client.id);

  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';
  const t = (k: string, v?: Record<string, string | number>) => pt(locale, k, v);
  const next = data.upcoming[0];
  const outstanding = portalAssessments.filter((q) => !data.assessments[q.type]);
  const completed = data.past.filter((b) => b.status === 'COMPLETED');
  const dateFmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', opts);
  const missingProfile = !client.phone || !client.dob;
  const { suitableForGender } = await import('@/lib/treatments');
  const featured = (FEATURED.map(getTreatment).filter(Boolean) as Treatment[])
    .filter((tr) => suitableForGender(tr, client.gender))
    .slice(0, 6);

  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayHours = site.hours.find((h) => h.day === DOW[new Date().getDay()]);
  const openToday = !!todayHours && todayHours.open !== 'Closed';

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

      <div className="mt-8"><OffersStrip heading="Offers for you" /></div>

      {data.discount && (
        <Reveal>
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-gradient-to-br from-[var(--color-bone)] to-[var(--color-sand)]/50 p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/15 text-[var(--color-gold)]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7C12 7 12 2 8.5 2S5 7 12 7zM12 7s0-5 3.5-5S19 7 12 7z" strokeLinejoin="round" /></svg>
              </span>
              <div>
                <p className="font-medium">{t('dash.offerReady')}</p>
                <p className="mt-0.5 text-sm text-[var(--color-stone)]">{t('dash.offerBody', { percent: data.discount.percent, code: '' }).replace(/—.*/, '').trim()}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-soft)]">{t('dash.offerCode')}</span>
                  <DiscountChip code={data.discount.code} copyLabel={t('dash.copy')} copiedLabel={t('dash.copied')} />
                </div>
              </div>
            </div>
            <Link href="/book" className="rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)]">{t('dash.book')}</Link>
          </div>
        </Reveal>
      )}

      {loyalty.balance > 0 && (
        <Reveal>
          <Link href="/account/rewards" className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 transition-colors hover:border-[var(--color-gold)]">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/15 text-lg text-[var(--color-gold)]">★</span>
              <div>
                <p className="font-[family-name:var(--font-display)] text-2xl">{loyalty.balance.toLocaleString(locale === 'uk' ? 'uk-UA' : 'en-GB')} <span className="text-sm font-normal text-[var(--color-stone)]">{t('rw.points')}</span></p>
                <p className="mt-0.5 text-sm text-[var(--color-stone)]">{t('rw.worth', { value: formatPrice(loyalty.valuePence) })}</p>
              </div>
            </div>
            <span className="text-sm font-medium text-[var(--color-gold)]">{t('nav.rewards')} →</span>
          </Link>
        </Reveal>
      )}

      {/* Asymmetric editorial layout — main column + functional right rail */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-8">
          {missingProfile && (
            <Reveal>
              <Link href="/account/profile" className="group flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-5 transition-colors hover:border-[var(--color-gold)]">
                <div>
                  <p className="text-sm font-medium">{t('dash.profilePrompt')}</p>
                  <p className="text-sm text-[var(--color-stone)]">{t('dash.profileBody')}</p>
                </div>
                <span className="shrink-0 text-sm font-medium text-[var(--color-gold)] transition-transform group-hover:translate-x-0.5">{t('dash.updateProfile')} →</span>
              </Link>
            </Reveal>
          )}

          <Reveal delay={0.05}>
            <div className="grid gap-6 sm:grid-cols-2">
              <Card title={t('dash.healthForms')}>
                {outstanding.length ? (
                  <ul className="space-y-3">
                    {outstanding.map((q) => {
                      const lq = localizeQuestionnaire(q, locale);
                      return (
                        <li key={q.key} className="flex items-center justify-between gap-3">
                          <span>{lq.title}</span>
                          <Link href={`/account/assessments/${q.key}`} className="shrink-0 rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)]">
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

              {completed.length > 0 && (
                <Card title={t('dash.history')} className="sm:col-span-2">
                  <ol className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                    {completed.slice(0, 6).map((b) => (
                      <li key={b.id} className="flex items-baseline justify-between gap-3 border-b border-[var(--color-line)] pb-2 last:border-0">
                        <span className="text-sm font-medium">{b.treatmentTitle}</span>
                        <span className="shrink-0 text-xs text-[var(--color-stone)]">{dateFmt(b.startAt, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </div>
          </Reveal>
        </div>

        {/* Right rail */}
        <aside className="space-y-6 lg:col-span-4">
          <Reveal delay={0.1}>
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)]">
              <RailHeading>{t('dash.quickActions')}</RailHeading>
              <ul className="mt-4 space-y-1">
                {[
                  { href: '/book', label: t('dash.qaBook'), primary: true },
                  { href: outstanding[0] ? `/account/assessments/${outstanding[0].key}` : '/account/assessments', label: t('dash.qaForms') },
                  { href: '/account/invoices', label: t('dash.qaInvoices') },
                  { href: '/account/profile', label: t('dash.qaProfile') },
                ].map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} className={`group flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5 text-sm transition-colors ${a.primary ? 'bg-[var(--color-ink)] font-medium text-[var(--color-porcelain)] hover:bg-[var(--color-gold)]' : 'hover:bg-[var(--color-bone)]'}`}>
                      {a.label}
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Visit us — clinic info */}
          <Reveal delay={0.15}>
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-soft)]">
              <div className="border-b border-[var(--color-line)] p-6">
                <RailHeading>{t('dash.visitUs')}</RailHeading>
                <p className="mt-3 font-[family-name:var(--font-display)] text-lg leading-tight">{site.address.street}</p>
                <p className="text-sm text-[var(--color-stone)]">{[site.address.locality, site.address.postalCode].filter(Boolean).join(', ')}</p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${openToday ? 'bg-green-600' : 'bg-[var(--color-stone-soft)]'}`} />
                  <span className={openToday ? 'text-[var(--color-ink)]' : 'text-[var(--color-stone)]'}>
                    {openToday ? `${t('dash.openToday')} · ${todayHours!.open}–${todayHours!.close}` : t('dash.closedToday')}
                  </span>
                </div>
                <a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium text-[var(--color-gold)] hover:text-[var(--color-ink)]">{t('dash.directions')} →</a>
              </div>
              <div className="bg-[var(--color-bone)] p-6">
                <RailHeading>{t('dash.needHelp')}</RailHeading>
                <a href={site.phoneHref} className="mt-3 flex items-center gap-2.5 text-sm font-medium hover:text-[var(--color-gold)]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--color-gold)]" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" strokeLinejoin="round" /></svg>
                  {site.phone}
                </a>
                <a href={site.emailHref} className="mt-2.5 flex items-center gap-2.5 text-sm font-medium hover:text-[var(--color-gold)]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--color-gold)]" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                  {site.email}
                </a>
              </div>
            </div>
          </Reveal>
        </aside>
      </div>

      {/* Curated treatments — full-width imagery */}
      {featured.length > 0 && (
        <section className="mt-16">
          <Reveal>
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-2 inline-flex items-center gap-2.5"><span className="h-px w-7 bg-[var(--color-gold)]/60" />{t('dash.curatedEyebrow')}</p>
                <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.7rem,1.2rem+1.6vw,2.6rem)] leading-tight">{t('dash.curatedTitle')}</h2>
              </div>
              <Link href="/treatments" className="hidden shrink-0 text-sm font-medium text-[var(--color-gold)] hover:text-[var(--color-ink)] sm:block">{t('dash.explore')} →</Link>
            </div>
          </Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((tr, i) => (
              <StaggerItem key={tr.slug}>
                <TreatmentCard t={tr} index={i} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {/* Closing invitation */}
      <Reveal>
        <section className="relative mt-16 mb-4 overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-ink)] p-10 text-center text-[var(--color-porcelain)] sm:p-16">
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_120%_at_50%_0%,color-mix(in_oklab,var(--color-gold)_26%,transparent),transparent_60%)]" />
          <div className="relative z-10">
            <h2 className="mx-auto max-w-xl font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.2rem+2vw,2.8rem)] leading-tight">{t('dash.ctaTitle')}</h2>
            <p className="mx-auto mt-3 max-w-md text-[color-mix(in_oklab,var(--color-porcelain)_78%,transparent)]">{t('dash.ctaBody')}</p>
            <Link href="/book" className="mt-7 inline-block rounded-full bg-[var(--color-gold)] px-7 py-3.5 text-sm font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-white hover:text-[var(--color-ink)]">{t('dash.book')}</Link>
          </div>
        </section>
      </Reveal>
    </PortalShell>
  );
}

function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-6 bg-[var(--color-gold)]" />
      <h2 className="eyebrow">{children}</h2>
    </div>
  );
}

function Card({ title, href, linkLabel, className = '', children }: { title: string; href?: string; linkLabel?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`group flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-gold)]/40 hover:shadow-[var(--shadow-lift)] ${className}`}>
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
