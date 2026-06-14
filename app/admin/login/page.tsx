import type { Metadata } from 'next';
import { AuthShell } from '@/components/portal/AuthShell';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { googleSsoEnabled } from '@/lib/google-sso';

export const metadata: Metadata = {
  title: 'Staff sign in | KClinics CRM',
  robots: { index: false, follow: false },
};

export default async function AdminLogin() {
  const ssoEnabled = await googleSsoEnabled();
  return (
    <AuthShell
      eyebrow="Staff & clinicians"
      heading="CRM sign in"
      sub="Access client records, bookings and clinical assessments."
      panelTitle="The clinic, beautifully in hand."
      panelPoints={[
        'Manage clients, consultations & bookings',
        'Review encrypted health assessments (clinical roles)',
        'Charge, reschedule & handle cancellations',
        'Marketing automations & campaigns',
      ]}
    >
      <AdminLoginForm ssoEnabled={ssoEnabled} />
    </AuthShell>
  );
}
