import { redirect } from 'next/navigation';
import Link from 'next/link';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SeoDashboard } from '@/components/admin/SeoDashboard';
import { TrackingSettings } from '@/components/admin/TrackingSettings';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function SeoPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { auditSite } = await import('@/lib/seo-audit');
  const { getTrackingConfig } = await import('@/lib/tracking');
  const { conversionStatus } = await import('@/lib/conversions');
  const { searchConsolePerformance } = await import('@/lib/search-console');
  const [audit, tracking, conversions, gsc] = await Promise.all([auditSite(), getTrackingConfig(), conversionStatus(), searchConsolePerformance(28)]);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">SEO &amp; AI search</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        Per-page ratings across on-page, technical, AI-answer (GEO) and local search, with an overall site health score.
        Edit any page’s SEO and get AI-written suggestions.
      </p>
      <div className="mt-8 space-y-8">
        <TrackingSettings initial={tracking} conversions={conversions} />

        {/* Organic search — live top queries from Search Console (when connected). */}
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg">Organic search <span className="text-xs font-normal text-[var(--color-stone)]">· Search Console · 28 days</span></h2>
            {gsc.configured && <span className="text-xs text-[var(--color-stone)] tabular-nums">{gsc.totals.clicks.toLocaleString('en-GB')} clicks · {gsc.totals.impressions.toLocaleString('en-GB')} impressions · {pct(gsc.totals.ctr)} CTR</span>}
          </div>
          {!gsc.configured ? (
            <p className="text-sm text-[var(--color-stone)]">Connect Google in <Link href="/admin/marketing/connections" className="underline">Connections</Link> (the Search Console scope is already requested) and make sure this site is verified in Search Console to see your top organic queries, impressions, CTR and average ranking here.</p>
          ) : gsc.topQueries.length === 0 ? (
            <p className="text-sm text-[var(--color-stone)]">No Search Console data for the last 28 days.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]"><th className="pb-2">Query</th><th className="pb-2 text-right">Clicks</th><th className="pb-2 text-right">Impr.</th><th className="pb-2 text-right">CTR</th><th className="pb-2 text-right">Pos.</th></tr></thead>
              <tbody>
                {gsc.topQueries.map((q) => (
                  <tr key={q.query} className="border-t border-[var(--color-line)]">
                    <td className="py-2">{q.query}</td>
                    <td className="py-2 text-right tabular-nums">{q.clicks.toLocaleString('en-GB')}</td>
                    <td className="py-2 text-right tabular-nums">{q.impressions.toLocaleString('en-GB')}</td>
                    <td className="py-2 text-right tabular-nums">{pct(q.ctr)}</td>
                    <td className="py-2 text-right tabular-nums">{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <SeoDashboard audit={audit} />
      </div>
    </AdminShell>
  );
}
