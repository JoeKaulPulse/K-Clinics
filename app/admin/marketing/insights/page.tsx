import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { HeatmapViewer } from '@/components/admin/HeatmapViewer';
import { ReplayList, type ReplayRow } from '@/components/admin/ReplayList';
import { getLocale } from '@/lib/locale';
import { site } from '@/lib/site';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');
  const sp = await searchParams;

  const { db } = await import('@/lib/db');
  // Pages with the most interactions.
  const grouped = await db.heatmapEvent.groupBy({ by: ['path'], _count: { _all: true }, orderBy: { _count: { path: 'desc' } }, take: 25 });
  const paths = grouped.map((g) => ({ path: g.path, count: g._count._all }));
  const path = sp.path && paths.some((p) => p.path === sp.path) ? sp.path : paths[0]?.path ?? '/';

  const [clicks, scrollRows, sessions] = await Promise.all([
    db.heatmapEvent.findMany({ where: { path, type: { in: ['click', 'rage'] } }, select: { xPct: true, yPct: true, type: true }, orderBy: { at: 'desc' }, take: 1500 }),
    db.heatmapEvent.findMany({ where: { path, type: 'scroll' }, select: { scrollPct: true }, take: 2000 }),
    db.replaySession.findMany({ orderBy: { startedAt: 'desc' }, take: 40, select: { id: true, path: true, device: true, durationMs: true, eventCount: true, startedAt: true } }),
  ]);

  const points = clicks.map((c) => ({ x: c.xPct, y: c.yPct, rage: c.type === 'rage' }));
  const avgScroll = scrollRows.length ? Math.round(scrollRows.reduce((s, r) => s + r.scrollPct, 0) / scrollRows.length / 10) : 0;
  const rage = points.filter((p) => p.rage).length;
  const replays: ReplayRow[] = sessions.map((s) => ({ id: s.id, path: s.path, device: s.device, durationMs: s.durationMs, eventCount: s.eventCount, startedAt: s.startedAt.toISOString() }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Behaviour insights</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Click heatmaps, scroll depth and full session replays — first-party and consent-gated. Inputs are masked; no
        personal data is captured.
      </p>

      {paths.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm text-[var(--color-stone)]">No interaction data yet — it appears once visitors accept analytics cookies and browse the site.</p>
      ) : (
        <div className="mt-8 space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--color-stone)]">Page:</span>
            {paths.map((p) => (
              <Link key={p.path} href={`/admin/marketing/insights?path=${encodeURIComponent(p.path)}`} className={`rounded-full px-3 py-1 text-xs ${p.path === path ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>{p.path} <span className="opacity-60">{p.count}</span></Link>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi label="Clicks captured" value={String(points.length)} />
            <Kpi label="Avg scroll depth" value={`${avgScroll}%`} />
            <Kpi label="Rage clicks" value={String(rage)} />
          </div>

          <HeatmapViewer path={path} baseUrl={site.url.replace(/\/$/, '')} points={points} />
          <ReplayList rows={replays} />
        </div>
      )}
    </AdminShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-soft)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
