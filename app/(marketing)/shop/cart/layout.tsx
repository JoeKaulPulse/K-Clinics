import type { Metadata } from 'next';

// The cart page is a client component (can't export metadata), so its noindex
// lives on this layout. Cart is a thin, transactional page — keep it out of
// the index.
export const metadata: Metadata = { title: 'Your bag — KClinics', robots: { index: false, follow: false } };

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
