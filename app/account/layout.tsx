import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Client portal | K Clinics',
  description: 'Manage your appointments, payments and pre-treatment assessments.',
  robots: { index: false, follow: false },
};

// Note: per-request rendering is set on the authenticated pages themselves
// (dashboard, appointments, assessments, invoices), not here — so the public
// login & signup pages can also be statically exported for the demo preview.

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--color-porcelain)] text-[var(--color-ink)]">{children}</div>;
}
