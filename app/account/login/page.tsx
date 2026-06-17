import { AuthShell } from '@/components/portal/AuthShell';
import { LoginForm } from '@/components/portal/LoginForm';
import { site } from '@/lib/site';

// Notices surfaced after a redirect (e.g. an expired passwordless activation link
// from /account/activate). Kept friendly and non-dead-end — a migrated client with
// no password can't just "log in", so we tell them how to get a fresh link.
function noticeText(notice?: string): string | null {
  switch (notice) {
    case 'link-expired':
      return `That sign-in link has expired or already been used. Please call us on ${site.phone} and we'll send you a fresh one.`;
    case 'link-invalid':
      return `That sign-in link looks incomplete. Please open the most recent link we emailed you, or call us on ${site.phone} for help.`;
    case 'too-many':
      return 'Too many attempts from your connection. Please wait a few minutes and try again.';
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const message = noticeText(notice);
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
      {message && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/40 bg-[var(--color-bone)] px-4 py-3 text-sm text-[var(--color-ink)]">
          {message}
        </div>
      )}
      <LoginForm />
    </AuthShell>
  );
}
