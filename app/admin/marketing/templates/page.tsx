import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { EmailTemplateGallery } from '@/components/admin/EmailTemplateGallery';
import { emailPreviews } from '@/lib/email-previews';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) redirect('/admin');

  const previews = emailPreviews();
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Email templates</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Every automated email your clients receive — booking confirmations, reminders, receipts, birthday offers and
        more — rendered live in your brand style. Preview exactly what lands in their inbox.
      </p>
      <div className="mt-8">
        <EmailTemplateGallery previews={previews} />
      </div>
    </AdminShell>
  );
}
