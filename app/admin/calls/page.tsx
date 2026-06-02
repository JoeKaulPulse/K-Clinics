import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { CallLog } from '@/components/admin/CallLog';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminCallsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'calls.view')) redirect('/admin');

  const can = await sessionPermissions();
  const locale = await getLocale();
  const configured = !!process.env.YAY_WEBHOOK_SECRET;
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Calls</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        Inbound &amp; outbound calls via yay.com — recordings, transcripts and the matched client. Records are immutable.
      </p>
      {!configured && (
        <p className="mt-4 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Telephony isn’t connected yet. Set <code>YAY_WEBHOOK_SECRET</code> (and <code>YAY_API_KEY</code> for click-to-dial),
          then point your yay.com call webhook at <code>/api/integrations/yay?token=…</code>. Calls will appear here automatically.
        </p>
      )}
      <div className="mt-6">
        <CallLog canManage={sessionCan(session, 'calls.manage')} />
      </div>
    </AdminShell>
  );
}
