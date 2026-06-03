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
      <div className="mt-8">
        <QrManager rows={rows} />
      </div>
    </AdminShell>
  );
}
