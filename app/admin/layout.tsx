import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'K Clinics CRM',
  robots: { index: false, follow: false },
};

// Minimal chrome for the CRM (no marketing header/footer). globals.css is
// already loaded by the root layout.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--color-bone)] text-[var(--color-ink)]">{children}</div>;
}
