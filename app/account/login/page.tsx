import { AuthShell } from '@/components/portal/AuthShell';
import { LoginForm } from '@/components/portal/LoginForm';

export default function LoginPage() {
  return (
    <AuthShell
      heading="Welcome back"
      sub="Sign in to manage your appointments, payments and health forms."
      panelTitle="Your care, in one calm place."
      panelPoints={[
        'View & manage every appointment',
        'Complete pre-treatment health forms securely',
        'See payments and download invoices',
        'Book your next visit in moments',
      ]}
    >
      <LoginForm />
    </AuthShell>
  );
}
