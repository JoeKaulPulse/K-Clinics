import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CampaignsList, type CampaignRow } from '@/components/admin/CampaignsList';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const { campaignStats } = await import('@/lib/marketing');
  const campaigns = await db.marketingCampaign.findMany({ orderBy: { createdAt: 'desc' } });
  const rows: CampaignRow[] = await Promise.all(campaigns.map(async (c) => {
    const stats = await campaignStats(c.id, c.spendPence);
    return {
      id: c.id, name: c.name, slug: c.slug, status: c.status, goal: c.goal,
      startAt: c.startAt?.toISOString() ?? null, endAt: c.endAt?.toISOString() ?? null,
      channels: c.channels, bookings: stats.bookings, revenuePence: stats.revenuePence, roi: stats.roi,
    };
  }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Campaigns</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Run cross-channel campaigns (e.g. “Valentine’s Day”) that tie together email, paid ads, SEO and landing pages.
        Bookings and revenue are attributed back automatically.
      </p>
      <div className="mt-8">
        <CampaignsList rows={rows} canManage={sessionCan(session, 'campaigns.send') || sessionCan(session, 'settings.manage')} />
      </div>
    </AdminShell>
  );
}
