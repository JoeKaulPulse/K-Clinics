import type { Metadata, Viewport } from 'next';

// Makes /academy installable as its own "K Academy" app (its own manifest, iOS
// web-app metadata) and opts the academy into edge-to-edge layout on notched
// phones. Passthrough — the marketing chrome still comes from the group layout.
export const metadata: Metadata = {
  manifest: '/academy.webmanifest',
  appleWebApp: { capable: true, title: 'K Academy', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#2a2420',
  viewportFit: 'cover',
};

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
