import { site } from '@/lib/site';
import { renderOg, ogSize, ogContentType } from '@/lib/og';

// Generated at build time (Node) so it works in a static export for GitHub Pages.
export const dynamic = 'force-static';
export const alt = `${site.name} — ${site.tagline}`;
export const size = ogSize;
export const contentType = ogContentType;

// BLD-1389: this file is Next's site-wide OG fallback and organizationLd()'s
// canonical schema.org image — every real page (including the homepage) sets
// its own OG tags via pageMeta, which points at the dynamic /og route instead,
// so this route is never rendered as a per-page photographic social card in
// practice. It previously passed `image: pageImage('home')` anyway, which made
// renderOg rasterize a full-bleed photo into the output PNG — next/og's
// ImageResponse always encodes losslessly, so a photographic 1200×630
// background costs ~800KB+ regardless of the source JPEG's own size/quality
// (verified: even an aggressively downscaled + heavily compressed source still
// rasterizes to several hundred KB once resvg fills the full canvas with it).
// Dropping the photo brings this in line with the dynamic route's ~54KB
// no-image default — the brand mark, tagline and gold accent bar are
// unchanged, only the incidental stock backdrop is gone.
export default function OG() {
  return renderOg({
    eyebrow: `${site.name} · London`,
    title: site.tagline,
    accent: 'beautifully personal',
  });
}
