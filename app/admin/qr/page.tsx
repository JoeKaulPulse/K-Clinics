import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { QrManager, type QrRow } from '@/components/admin/QrManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function QrPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const { qrUrl, qrSvg } = await import('@/lib/qr');

  const codes = await db.qrCode.findMany({ orderBy: { createdAt: 'desc' } });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await db.qrScan.groupBy({ by: ['qrCodeId'], where: { at: { gte: since } }, _count: { _all: true }, _max: { at: true } });
  const recentMap = new Map(recent.map((r) => [r.qrCodeId, { last30: r._count._all, lastAt: r._max.at }]));

  const rows: QrRow[] = await Promise.all(codes.map(async (c) => ({
    id: c.id,
    code: c.code,
    label: c.label,
    destination: c.destination,
    active: c.active,
    notes: c.notes,
    scanCount: c.scanCount,
    last30: recentMap.get(c.id)?.last30 ?? 0,
    lastAt: recentMap.get(c.id)?.lastAt?.toISOString() ?? null,
    url: qrUrl(c.code),
    svg: await qrSvg(qrUrl(c.code)),
  })));

  // ── Skin & Smile kiosk funnel (KioskEvent counts) ─────────────────────────
  const kioskCounts = await db.kioskEvent.groupBy({ by: ['event'], _count: { _all: true } }).catch(() => []);
  const kiosk = Object.fromEntries(kioskCounts.map((k) => [k.event, k._count._all])) as Record<string, number>;
  const funnel: { label: string; value: number }[] = [
    { label: 'Scans', value: kiosk.scan ?? 0 },
    { label: 'Photos taken', value: kiosk.photo ?? 0 },
    { label: 'Analyses done', value: kiosk.analyzed ?? 0 },
    { label: 'Shares', value: kiosk.shared ?? 0 },
    { label: 'Claims', value: kiosk.claimed ?? 0 },
  ];

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">QR codes</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Create QR codes for posters, flyers and in-clinic signage. Each code is a permanent link
        (<code>/qr/&lt;code&gt;</code>) you can <strong>re-point to a new destination any time</strong> — so a printed
        code never needs reprinting. Scans are tracked for analytics (device &amp; country only — no personal data).
      </p>

      <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)]/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">Skin &amp; Smile Kiosk</h2>
            <p className="mt-1 text-sm text-[var(--color-stone)]">
              The storefront screen should be pointed to <code>/kiosk/display</code> in the browser.
            </p>
          </div>
          <a
            href="/kiosk/display"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[var(--radius-md)] bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] transition hover:opacity-90"
          >
            Open storefront display ↗
          </a>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {funnel.map((f) => (
            <div key={f.label} className="rounded-[var(--radius-md)] bg-[var(--color-porcelain)] p-4 text-center">
              <dt className="text-xs uppercase tracking-wide text-[var(--color-stone)]">{f.label}</dt>
              <dd className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8">
        <QrManager rows={rows} />
      </div>
    </AdminShell>
  );
}
