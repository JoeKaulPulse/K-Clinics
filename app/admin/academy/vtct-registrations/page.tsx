import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { VtctRegistrationReview } from '@/components/admin/VtctRegistrationReview';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-1794: staff review queue for trainees' VTCT Registration Details.
export default async function AdminVtctRegistrationsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { adminListRegistrations, STATUS_LABEL } = await import('@/lib/vtct-registration');
  const registrations = await adminListRegistrations();

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">VTCT Registrations</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">Personal details and identity documents trainees have submitted for their registration with the awarding body. Check the details against the uploaded documents, then confirm — a trainee who edits confirmed details is flagged here for re-review rather than silently overwriting what was confirmed.</p>
      <div className="mt-8">
        <VtctRegistrationReview registrations={registrations} statusLabels={STATUS_LABEL} />
      </div>
    </AdminShell>
  );
}
