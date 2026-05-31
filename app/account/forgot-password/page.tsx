import { AuthShell } from '@/components/portal/AuthShell';
import { ForgotPasswordForm } from '@/components/portal/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      heading="Reset your password"
      sub="Enter your email and we’ll send you a secure link to set a new password."
      panelTitle="We’ll get you back in."
      panelPoints={[
        'A secure, time-limited reset link',
        'Your data stays encrypted and private',
        'Back to your appointments in moments',
      ]}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
