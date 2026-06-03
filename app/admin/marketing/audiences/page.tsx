import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { AudienceManager, type SegmentRow } from '@/components/admin/AudienceManager';
import type { SegmentRules } from '@/lib/segments';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AudiencesPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const { countSegment, describeRules } = await import('@/lib/segments');
  const segments = await db.segment.findMany({ orderBy: { createdAt: 'desc' } });
  const rows: SegmentRow[] = await Promise.all(segments.map(async (s) => {
    const rules = (s.rules as SegmentRules) ?? {};
    return { id: s.id, name: s.name, description: s.description ?? '', rules, summary: describeRules(rules), size: await countSegment(rules) };
  }));

  // Distinct sources & tags to offer as quick filters.
  const clients = await db.client.findMany({ select: { source: true, tags: true }, take: 2000 });
  const sources = [...new Set(clients.map((c) => c.source).filter(Boolean) as string[])].sort().slice(0, 30);
  const tags = [...new Set(clients.flatMap((c) => c.tags))].sort().slice(0, 50);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Audiences</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Build reusable client segments — e.g. “lapsed female clients” or “opted-in, never visited” — with a live size
        estimate. Use them to target campaigns and email.
      </p>
      <div className="mt-8">
        <AudienceManager rows={rows} sources={sources} tags={tags} canManage={sessionCan(session, 'campaigns.send') || sessionCan(session, 'settings.manage')} />
      </div>
    </AdminShell>
  );
}
