import { site } from '@/lib/site';
import { renderOg, ogSize, ogContentType } from '@/lib/og';
import { pageImage } from '@/lib/treatment-images';

// Generated at build time (Node) so it works in a static export for GitHub Pages.
export const dynamic = 'force-static';
export const alt = `${site.name} — ${site.tagline}`;
export const size = ogSize;
export const contentType = ogContentType;

export default function OG() {
  return renderOg({
    eyebrow: `${site.name} · London`,
    title: site.tagline,
    accent: 'beautifully personal',
    image: pageImage('home'),
  });
}
