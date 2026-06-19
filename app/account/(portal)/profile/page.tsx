export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ProfileForm } from '@/components/portal/ProfileForm';
import { Reveal } from '@/components/motion/Reveal';
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
    <>
      <PortalPageHeader eyebrow={pt(locale, 'nav.profile')} title={pt(locale, 'profile.title')} />
      <ProfileForm
        locale={locale}
        initial={{
          firstName: client.firstName,
          lastName: client.lastName ?? '',
          email: client.email,
          phone: client.phone ?? '',
          dob: client.dob ? client.dob.toISOString().slice(0, 10) : '',
          gender: client.gender ?? '',
          genderSelfDescribe: client.genderSelfDescribe ?? '',
          marketingOptIn: client.marketingOptIn,
          smsReminders: client.smsReminders,
        }}
      />

      {/* Data & privacy (GDPR self-service) */}
      <Reveal delay={0.1}>
        <section className="mt-12 max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-gold)]/40 hover:shadow-[var(--shadow-lift)]">
          <h2 className="eyebrow mb-2">{pt(locale, 'privacy.title')}</h2>
          <p className="text-sm text-[var(--color-stone)]">{pt(locale, 'privacy.body')}</p>
          <a href="/api/account/export" className="mt-4 inline-block rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">
            {pt(locale, 'privacy.download')}
          </a>
          <p className="mt-4 text-xs text-[var(--color-stone)]">
            {pt(locale, 'privacy.erase')}{' '}
            <a href="/contact" className="font-medium text-[var(--color-gold)]">{pt(locale, 'privacy.contact')}</a>
          </p>
        </section>
      </Reveal>
    </>
  );
}
