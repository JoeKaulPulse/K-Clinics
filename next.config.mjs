/** @type {import('next').NextConfig} */

// When deploying to GitHub Pages we produce a fully static export served from a
// sub-path (https://<user>.github.io/<repo>/). The Actions workflow sets these.
const isPages = process.env.GHPAGES === 'true';
const repoBase = process.env.PAGES_BASE_PATH || '';

// ── Security headers (applied to every route in the hosted build) ───────────
// CSP is allowlisted for the integrations we use (Stripe, Cloudflare Turnstile,
// YouTube embeds, Google Maps, Google Fonts). If a new third party is blocked,
// set CSP_DISABLED=true in the environment to ship without CSP while adjusting.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://maps.googleapis.com https://maps.gstatic.com",
  "connect-src 'self' https://api.stripe.com https://m.stripe.network https://r.stripe.com https://challenges.cloudflare.com https://maps.googleapis.com https://blob.vercel-storage.com https://*.public.blob.vercel-storage.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  ...(process.env.CSP_DISABLED === 'true' ? [] : [{ key: 'Content-Security-Policy', value: csp }]),
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const headers = async () => [{ source: '/(.*)', headers: securityHeaders }];

const redirects = async () => [
  // Preserve SEO equity from the legacy site's URL structure.
  { source: '/about-kclinics', destination: '/about', permanent: true },
  { source: '/our-clinics', destination: '/contact', permanent: true },
  { source: '/cosmetology-all-treatments', destination: '/treatments', permanent: true },
  { source: '/dentistry-all-treatments', destination: '/dentistry', permanent: true },
  { source: '/kclinics-beauty-points', destination: '/membership', permanent: true },
  { source: '/personalized-high-end-treatments', destination: '/about', permanent: true },
  { source: '/individualised-treatment-plans', destination: '/about', permanent: true },
  // IPL Phototherapy retired from the menu — send old links to the treatments hub.
  { source: '/ipl-phototherapy', destination: '/treatments', permanent: true },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Tree-shake large client libraries → smaller client bundles.
  experimental: { optimizePackageImports: ['motion'] },
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
    : { redirects, headers }),
};

export default nextConfig;
