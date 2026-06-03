import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { BrandKitManager } from '@/components/admin/BrandKitManager';
import { getBrandKit } from '@/lib/brand';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function BrandPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const brand = await getBrandKit();
  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Brand kit</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Your single source of brand truth — colours, fonts, logos, tagline and tone of voice. Everything marketing
        uses it: email templates, generated landing pages and the AI assistant all stay on-brand automatically.
      </p>
      <div className="mt-8">
        <BrandKitManager initial={brand} />
      </div>
    </AdminShell>
  );
}
