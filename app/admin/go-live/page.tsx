import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { goLiveChecklist } from '@/lib/go-live';
import { GoLiveChecklist } from '@/components/admin/GoLiveChecklist';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function GoLivePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { groups } = await goLiveChecklist();
  const can = await sessionPermissions();
  const locale = await getLocale();

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Go live</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Your launch checklist, validated live. <strong>Action needed</strong> items are launch-critical;{' '}
        <strong>Optional</strong> ones can follow. Items marked <em>with owner</em> are the accounts &amp; DNS to set up
        together on your call — tick them off as you go. Everything else is detected automatically (keys, DNS, content).
      </p>

      <GoLiveChecklist groups={groups} />

      <p className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5 text-sm text-[var(--color-stone)]">
        Auto-checked items (Stripe, Resend, DNS/SPF/DKIM, encryption, services…) update themselves the moment the key, DNS
        record or content is in place — refresh to re-validate. The <em>manual</em> tasks are ticked here and saved for everyone.
      </p>
    </AdminShell>
  );
}
