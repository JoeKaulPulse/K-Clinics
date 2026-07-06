// Whether a CMS / page-builder image URL can be run through the next/image
// optimiser. next/image throws at runtime for a remote host that isn't in
// next.config.mjs `images.remotePatterns`, so only the two allowed sources are
// optimised: same-origin `/public` paths and Vercel Blob uploads (where admin
// uploads land). Any other external URL — an admin pasting an arbitrary image
// address — falls back to `unoptimized`, which is still lazy-loaded, just not
// AVIF/WebP/srcset, and can never crash the page. (BLD-756)
export function cmsImageOptimizable(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('/') && !src.startsWith('//')) return true; // same-origin /public
  try {
    return /(^|\.)blob\.vercel-storage\.com$/i.test(new URL(src).hostname);
  } catch {
    return false; // data:, protocol-relative or malformed → serve unoptimised
  }
}
