import { AuthShell } from '@/components/portal/AuthShell';
import { ResetPasswordForm } from '@/components/portal/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <AuthShell
      heading="Choose a new password"
      sub="Pick something memorable and secure — at least 8 characters."
      panelTitle="Almost there."
      panelPoints={['Your new password takes effect immediately', 'You’ll be signed straight in', 'Everything stays encrypted']}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
