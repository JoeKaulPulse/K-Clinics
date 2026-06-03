import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { EmailComposer } from '@/components/admin/EmailComposer';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function NewEmailPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.send')) redirect('/admin/marketing/email');

  const { db } = await import('@/lib/db');
  const [segments, clients] = await Promise.all([
    db.segment.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true } }),
    db.client.findMany({ where: { marketingOptIn: true, unsubscribed: false }, select: { tags: true }, take: 2000 }),
  ]);
  const tags = [...new Set(clients.flatMap((c) => c.tags))].sort().slice(0, 50);

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">New email</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Build a branded email, choose who receives it, preview, test, then send via Resend.</p>
      <div className="mt-6">
        <EmailComposer segments={segments} tags={tags} />
      </div>
    </AdminShell>
  );
}
