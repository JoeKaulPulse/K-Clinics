import type { Metadata } from 'next';
import { AuthShell } from '@/components/portal/AuthShell';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export const metadata: Metadata = {
  title: 'Staff sign in | K Clinics CRM',
  robots: { index: false, follow: false },
};

export default function AdminLogin() {
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
      <AdminLoginForm />
    </AuthShell>
  );
}
