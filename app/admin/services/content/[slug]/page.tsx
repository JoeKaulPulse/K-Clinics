import { redirect, notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { TreatmentContentEditor } from '@/components/admin/TreatmentContentEditor';
import { getTreatmentContentForEdit } from '@/lib/treatment-content';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function TreatmentContentPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { slug } = await params;
  const loaded = await getTreatmentContentForEdit(slug);
  if (!loaded) notFound();

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <TreatmentContentEditor slug={slug} base={loaded.base} override={loaded.override as Record<string, unknown> | null} />
    </AdminShell>
  );
}
