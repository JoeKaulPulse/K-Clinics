import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { MediaGrid } from '@/components/admin/MediaPicker';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Media library</h1>
      <p className="mt-1 mb-6 text-sm text-[var(--color-stone)]">Upload and manage images used across the journal, page sections and more.</p>
      <MediaGrid />
    </AdminShell>
  );
}
