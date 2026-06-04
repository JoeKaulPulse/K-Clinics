import type { Metadata } from 'next';

// In-store kiosk: full-screen, no site header/footer/chat (it lives outside the
// marketing layout). noindex — it's a device surface, not a public page.
export const metadata: Metadata = {
  title: 'KClinics — Find your treatment',
  robots: { index: false, follow: false },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--color-ink)]">{children}</div>;
}
