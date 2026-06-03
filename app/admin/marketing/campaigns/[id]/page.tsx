import { redirect, notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CampaignEditor, type CampaignData } from '@/components/admin/CampaignEditor';
import { CampaignAiPanel } from '@/components/admin/CampaignAiPanel';
import { getLocale } from '@/lib/locale';
import { site } from '@/lib/site';
import { aiAvailable } from '@/lib/ai-marketing';
import type { CampaignPack } from '@/lib/ai-marketing';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');
  const { id } = await params;

  const { db } = await import('@/lib/db');
  const { campaignStats } = await import('@/lib/marketing');
  const c = await db.marketingCampaign.findUnique({ where: { id } });
  if (!c) notFound();
  const stats = await campaignStats(c.id, c.spendPence);

  const data: CampaignData = {
    id: c.id, name: c.name, slug: c.slug, status: c.status, goal: c.goal ?? 'bookings',
    audience: c.audience ?? '', description: c.description ?? '', brief: c.brief ?? '', heroImage: c.heroImage ?? '',
    utmCampaign: c.utmCampaign ?? c.slug,
    startAt: c.startAt ? c.startAt.toISOString().slice(0, 10) : '', endAt: c.endAt ? c.endAt.toISOString().slice(0, 10) : '',
    budget: c.budgetPence != null ? (c.budgetPence / 100).toString() : '', spend: (c.spendPence / 100).toString(),
    targetRevenue: c.targetRevenuePence != null ? (c.targetRevenuePence / 100).toString() : '',
    targetBookings: c.targetBookings != null ? String(c.targetBookings) : '',
    channels: c.channels,
  };

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <CampaignEditor
        data={data}
        stats={stats}
        baseUrl={site.url.replace(/\/$/, '')}
        canManage={sessionCan(session, 'campaigns.send') || sessionCan(session, 'settings.manage')}
      />
      <div className="mt-6">
        <CampaignAiPanel campaignId={c.id} enabled={aiAvailable()} initial={(c.aiDraft as CampaignPack | null) ?? null} />
      </div>
    </AdminShell>
  );
}
