import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Client portal | K Clinics',
  description: 'Manage your appointments, payments and pre-treatment assessments.',
  robots: { index: false, follow: false },
};

// The portal is always rendered per-request (auth + personal data).
export const dynamic = 'force-dynamic';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--color-porcelain)] text-[var(--color-ink)]">{children}</div>;
}
