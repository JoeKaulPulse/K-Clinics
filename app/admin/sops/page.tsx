import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SopManager } from '@/components/admin/SopManager';
import { bookableTreatments } from '@/lib/treatments';

export const dynamic = 'force-dynamic';

export default async function SopsPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'sop.manage')) redirect('/admin');

  const { getSop } = await import('@/lib/sops');
  const items = await Promise.all(
    bookableTreatments.map(async (t) => {
      const sop = await getSop(t.slug);
      return { slug: t.slug, treatmentTitle: t.title, title: sop.title, content: sop.content, source: sop.source };
    }),
  );

  const can = await sessionPermissions();
  return (
    <AdminShell user={session?.email} can={can}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Standard operating procedures</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        Edit the SOP clinicians must acknowledge before each treatment. Treatments without a custom SOP show a sensible default.
      </p>
      <div className="mt-8">
        <SopManager items={items} />
      </div>
    </AdminShell>
  );
}
