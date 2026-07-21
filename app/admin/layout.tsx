import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KClinics CRM',
  robots: { index: false, follow: false },
};

// Minimal chrome for the CRM (no marketing header/footer). globals.css is
// already loaded by the root layout.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bone)] text-[var(--color-ink)]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--color-ink)] focus:px-5 focus:py-3 focus:text-[var(--color-porcelain)]"
      >
        Skip to content
      </a>
      {children}
    </div>
  );
}
