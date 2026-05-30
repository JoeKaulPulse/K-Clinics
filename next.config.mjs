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
  images: {
    formats: ['image/avif', 'image/webp'],
    // GitHub Pages has no image optimiser; serve images as-is.
    unoptimized: isPages,
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
