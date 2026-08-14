import type { Metadata } from 'next';

// In-store kiosk: full-screen, no site header/footer/chat (it lives outside the
// marketing layout). noindex — it's a device surface, not a public page.
export const metadata: Metadata = {
  title: 'KClinics — Find your treatment',
  robots: { index: false, follow: false },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-ink)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--color-gold)] focus:px-5 focus:py-3 focus:text-[var(--color-ink)]"
      >
        Skip to content
      </a>
      <main id="main">{children}</main>
    </div>
  );
}
