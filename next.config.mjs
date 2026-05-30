/** @type {import('next').NextConfig} */

// When deploying to GitHub Pages we produce a fully static export served from a
// sub-path (https://<user>.github.io/<repo>/). The Actions workflow sets these.
const isPages = process.env.GHPAGES === 'true';
const repoBase = process.env.PAGES_BASE_PATH || '';

const redirects = async () => [
  // Preserve SEO equity from the legacy site's URL structure.
  { source: '/about-kclinics', destination: '/about', permanent: true },
  { source: '/our-clinics', destination: '/contact', permanent: true },
  { source: '/cosmetology-all-treatments', destination: '/treatments', permanent: true },
  { source: '/dentistry-all-treatments', destination: '/dentistry', permanent: true },
  { source: '/kclinics-beauty-points', destination: '/membership', permanent: true },
  { source: '/personalized-high-end-treatments', destination: '/about', permanent: true },
  { source: '/individualised-treatment-plans', destination: '/about', permanent: true },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Exposed to client + server so image paths from /public can be prefixed with
  // the Pages sub-path. next/image does NOT prepend basePath to unoptimized
  // /public images in a static export, so we do it ourselves (see treatment-images).
  env: { NEXT_PUBLIC_BASE_PATH: repoBase },
  images: {
    formats: ['image/avif', 'image/webp'],
    // GitHub Pages has no image optimiser; serve images as-is.
    unoptimized: isPages,
    // Allow SVG to be served through next/image (brand logo, icons).
    dangerouslyAllowSVG: true,
    contentDispositionType: 'inline',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  ...(isPages
    ? {
        output: 'export',
        basePath: repoBase,
        assetPrefix: repoBase || undefined,
        trailingSlash: true,
        // redirects() and the rewrites engine aren't available in static export.
      }
    : { redirects }),
};

export default nextConfig;
