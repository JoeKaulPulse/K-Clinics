import type { Metadata } from 'next';

// PRJ-63 — public contractor reception flow. Standalone surface (no site
// header/footer/chat, no admin chrome): it lives outside the marketing and admin
// layouts. noindex — it is a reception sign-in surface, not a public web page.
export const metadata: Metadata = {
  title: 'Contractor sign-in — KClinics',
  robots: { index: false, follow: false },
};

export default function ContractorLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--color-porcelain)] text-[var(--color-ink)]">{children}</div>;
}
