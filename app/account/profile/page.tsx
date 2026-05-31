export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { ProfileForm } from '@/components/portal/ProfileForm';
import { crmEnabled } from '@/lib/crm';
import { pt } from '@/lib/i18n-portal';
import type { Locale } from '@/lib/i18n';

export default async function ProfilePage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');
  const locale: Locale = client.locale === 'uk' ? 'uk' : 'en';

  return (
    <PortalShell firstName={client.firstName} locale={locale}>
      <div className="mb-8">
        <p className="eyebrow mb-2">{pt(locale, 'nav.profile')}</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">{pt(locale, 'profile.title')}</h1>
      </div>
      <ProfileForm
        locale={locale}
        initial={{
          firstName: client.firstName,
          lastName: client.lastName ?? '',
          email: client.email,
          phone: client.phone ?? '',
          dob: client.dob ? client.dob.toISOString().slice(0, 10) : '',
          marketingOptIn: client.marketingOptIn,
        }}
      />
    </PortalShell>
  );
}
