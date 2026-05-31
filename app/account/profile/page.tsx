export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/PortalShell';
import { ProfileForm } from '@/components/portal/ProfileForm';
import { crmEnabled } from '@/lib/crm';

export default async function ProfilePage() {
  if (!crmEnabled) redirect('/account');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) redirect('/account/login');

  return (
    <PortalShell firstName={client.firstName} locale={client.locale === 'uk' ? 'uk' : 'en'}>
      <div className="mb-8">
        <p className="eyebrow mb-2">Profile</p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">Your details</h1>
        <p className="mt-2 text-[var(--color-stone)]">Keep your contact details and preferences up to date.</p>
      </div>
      <ProfileForm
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
