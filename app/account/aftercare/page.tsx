export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { Reveal } from '@/components/motion/Reveal';
import { crmEnabled } from '@/lib/crm';
import { getTreatment } from '@/lib/treatments';
import { guideForGroup, aftercareTitle, aftercareIntro, aftercareText, type AftercareItem } from '@/lib/aftercare';
import { pt } from '@/lib/i18n-portal';
import { site } from '@/lib/site';
import type { Locale } from '@/lib/i18n';

function Icon({ name }: { name: AftercareItem['icon'] }) {
  const common = { className: 'h-5 w-5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'sun': return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>;
    case 'water': return <svg viewBox="0 0 24 24" {...common}><path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z" /></svg>;
    case 'no-touch': return <svg viewBox="0 0 24 24" {...common}><path d="M5 5l14 14M9 11v-1a3 3 0 0 1 6 0v4" /><path d="M15 14v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4v-5" /></svg>;
    case 'cool': return <svg viewBox="0 0 24 24" {...common}><path d="M12 2v20M4 7l16 10M20 7L4 17" /></svg>;
    case 'rest': return <svg viewBox="0 0 24 24" {...common}><path d="M3 18v-6a2 2 0 0 1 2-2h9a4 4 0 0 1 4 4v4M3 14h18M3 18h18" /></svg>;
    case 'clock': return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'sparkle': return <svg viewBox="0 0 24 24" {...common}><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" /></svg>;
    case 'alert': return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>;
  }
}

export default async function AftercarePage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getDashboard } = await import('@/lib/portal-data');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const data = await getDashboard(client.id);

  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';
  const t = (k: string, v?: Record<string, string | number>) => pt(locale, k, v);

  // Unique treatments the client has booked (upcoming + past), newest first.
  const seen = new Set<string>();
  const treatments = [...data.upcoming, ...data.past]
    .filter((b) => (seen.has(b.treatmentSlug) ? false : (seen.add(b.treatmentSlug), true)))
    .map((b) => ({ slug: b.treatmentSlug, title: b.treatmentTitle, tr: getTreatment(b.treatmentSlug) }));

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <PortalPageHeader eyebrow={t('after.eyebrow')} title={t('after.title')} subtitle={t('after.intro')} />

      {treatments.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-10 text-center">
          <p className="mx-auto max-w-md text-[var(--color-stone)]">{t('after.empty')}</p>
          <Link href="/treatments" className="mt-5 inline-block rounded-full bg-[var(--color-gold)] px-6 py-3 text-sm font-medium text-white shadow-[var(--shadow-gold)] transition-[transform,background-color] hover:bg-[var(--color-ink)] active:scale-[0.97]">{t('after.exploreCta')}</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {treatments.map(({ slug, title, tr }, i) => {
            const guide = guideForGroup(tr?.group);
            return (
              <Reveal key={slug} delay={i * 0.04}>
                <section className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--color-gold)]/30 hover:shadow-[var(--shadow-lift)]">
                  <div className="border-b border-[var(--color-line)] bg-[var(--color-bone)]/50 p-6">
                    <p className="eyebrow">{t('after.forTreatment', { treatment: title })}</p>
                    <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-2xl">{aftercareTitle(guide, locale)}</h2>
                    <p className="mt-1.5 text-sm text-[var(--color-stone)]">{aftercareIntro(guide, locale)}</p>
                  </div>
                  <ul className="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
                    {guide.items.map((it, j) => (
                      <li key={j} className="flex items-start gap-3.5">
                        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-gold)]/12 text-[var(--color-gold)] transition-transform duration-300 ease-out group-hover:scale-110">
                          <Icon name={it.icon} />
                        </span>
                        <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">{aftercareText(it, locale)}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Help band */}
      <Reveal>
        <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
          <div>
            <p className="font-medium">{t('after.questions')}</p>
            <p className="text-sm text-[var(--color-stone)]">{t('after.questionsBody')}</p>
          </div>
          <a href={site.phoneHref} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] active:scale-[0.97]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--color-gold)]" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" strokeLinejoin="round" /></svg>
            {site.phone}
          </a>
        </section>
      </Reveal>
    </PortalShell>
  );
}
