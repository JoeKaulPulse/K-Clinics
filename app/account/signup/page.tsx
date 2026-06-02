import { cookies } from 'next/headers';
import { AuthShell } from '@/components/portal/AuthShell';
import { SignupWizard } from '@/components/portal/SignupWizard';
import { PORTAL_LOCALE_COOKIE } from '@/lib/i18n-portal';
import { isLocale, DEFAULT_LOCALE } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const c = (await cookies()).get(PORTAL_LOCALE_COOKIE)?.value;
  const initialLocale = isLocale(c) ? c : DEFAULT_LOCALE;
  return (
    <AuthShell
      heading="Create your account"
      sub="Join KClinics and enjoy 15% off your first treatment."
      panelTitle="15% off your first treatment."
      panelPoints={[
        'An exclusive welcome offer, applied once',
        'Securely manage appointments & payments',
        'Complete confidential health forms ahead of your visit',
        'Members-only events and early access',
      ]}
    >
      <SignupWizard initialLocale={initialLocale} />
    </AuthShell>
  );
}
