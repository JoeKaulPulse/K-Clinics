import { AuthShell } from '@/components/portal/AuthShell';
import { SignupForm } from '@/components/portal/SignupForm';

export default function SignupPage() {
  return (
    <AuthShell
      heading="Create your account"
      sub="Join K Clinics and enjoy 15% off your first treatment."
      panelTitle="15% off your first treatment."
      panelPoints={[
        'An exclusive welcome offer, applied once',
        'Securely manage appointments & payments',
        'Complete confidential health forms ahead of your visit',
        'Members-only events and early access',
      ]}
    >
      <SignupForm />
    </AuthShell>
  );
}
