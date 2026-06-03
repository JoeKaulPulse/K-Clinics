import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { EmailComposer } from '@/components/admin/EmailComposer';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function NewEmailPage({ searchParams }: { searchParams: Promise<{ id?: string; clone?: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.send')) redirect('/admin/marketing/email');
  const { id, clone } = await searchParams;

  const { db } = await import('@/lib/db');
  const [segments, clients] = await Promise.all([
    db.segment.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true } }),
    db.client.findMany({ where: { marketingOptIn: true, unsubscribed: false }, select: { tags: true }, take: 2000 }),
  ]);
  const tags = [...new Set(clients.flatMap((c) => c.tags))].sort().slice(0, 50);

  // Load an existing draft (editable) or clone a past/scheduled campaign (new copy).
  let initial: import('@/components/admin/EmailComposer').ComposerInitial | undefined;
  const loadId = id || clone;
  if (loadId) {
    const c = await db.campaign.findUnique({ where: { id: loadId } });
    if (c) {
      let blocks: unknown[] = [];
      try { blocks = JSON.parse(c.body); } catch { /* ignore */ }
      initial = {
        id: clone ? undefined : c.id, // editing keeps the id; cloning starts fresh
        name: clone ? `${c.name} (copy)` : c.name,
        subject: c.subject, preheader: c.preheader || '', fromName: c.fromName || '', replyTo: c.replyTo || '',
        blocks: blocks as never, audType: (c.audienceType as 'all' | 'segment' | 'tag') || 'all', audValue: c.audienceValue || '',
      };
    }
  }

  const can = await sessionPermissions();
  const locale = await getLocale();
  const editing = Boolean(id && initial);
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{editing ? 'Edit email' : 'New email'}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Build a branded email, choose who receives it, preview, test, then send or schedule via Resend.</p>
      <div className="mt-6">
        <EmailComposer segments={segments} tags={tags} initial={initial} />
      </div>
    </AdminShell>
  );
}
