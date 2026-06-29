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
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  // Native <video>/<audio> playback is governed by media-src, which falls back
  // to default-src 'self' when absent — that silently blocked every uploaded
  // lesson video/audio on *.public.blob.vercel-storage.com (they appeared but
  // wouldn't play). Mirror img-src so blob-hosted and direct https media play.
  "media-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://maps.googleapis.com https://maps.gstatic.com https://connect.facebook.net",
  // NB: the @vercel/blob *client* SDK performs client-direct uploads via
  // https://vercel.com/api/blob (not the storage host directly), so vercel.com
  // MUST be allowed here or every client-direct upload (team chat, academy PDFs,
  // homework, build attachments) is CSP-blocked in the browser.
  "connect-src 'self' https://api.stripe.com https://m.stripe.network https://r.stripe.com https://challenges.cloudflare.com https://maps.googleapis.com https://vercel.com https://blob.vercel-storage.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://*.sentry.io https://sentry.io https://connect.facebook.net https://graph.facebook.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  ...(process.env.CSP_DISABLED === 'true' ? [] : [{ key: 'Content-Security-Policy', value: csp }]),
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
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
  // POM-brand pages removed for CAP 12.12 / MHRA compliance (no advertising a
  // prescription-only medicine to the public). Their SEO equity is preserved by
  // redirecting to the compliant, generically-named injectables page.
  { source: '/botox', destination: '/cosmetic-injections', permanent: true },
  { source: '/kybella', destination: '/cosmetic-injections', permanent: true },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Tree-shake large client libraries → smaller client bundles.
  experimental: { optimizePackageImports: ['motion'] },
  // Pin the workspace root to THIS directory. Stray lockfiles above the project
  // (e.g. /vercel/package-lock.json on Vercel builders, /home/user/… in dev
  // containers) make Next infer the wrong root. With the wrong root, Turbopack
  // resolves externalised server packages (@prisma/client, pg, …) as "outside
  // the project" and emits hash-aliased requires backed by symlinks in
  // .next/node_modules whose targets escape the project directory
  // (../../../<dirname>/node_modules/<pkg>). Those symlinks break inside the
  // Vercel lambda filesystem → "Failed to load external module …: Cannot find
  // module" → 500 on every DB-touching route.
  turbopack: { root: import.meta.dirname },
  // BUNDLE the whole Prisma/pg stack into the compiled server chunks instead of
  // externalising it. Turbopack loads externalised server packages through
  // hash-aliased ids (require("@prisma/client-<hash>")) backed by symlinks in
  // .next/node_modules — and that machinery proved unreliable inside Vercel's
  // lambda filesystem: the ESM external import of @prisma/extension-accelerate
  // failed with "Failed to load external module …: Cannot find module" on every
  // DB-touching route, across cached AND clean builds. Listing the packages in
  // transpilePackages opts @prisma/client out of Next's DEFAULT external list
  // and forces all four to compile into the chunks: no external requires, no
  // symlinks, nothing left to resolve at runtime. The generated client's WASM
  // query compiler is embedded as base64 JS, so it bundles cleanly.
  transpilePackages: ['@prisma/client', '@prisma/adapter-pg', '@prisma/extension-accelerate', 'pg'],
  // Keep non-runtime files OUT of serverless function bundles. lib/og.tsx reads
  // images/fonts with a dynamic fs.readFileSync(path.join(process.cwd(), …)) that
  // Next/Turbopack can't statically analyse, so it traces the WHOLE project into
  // every route that transitively imports it via lib/seo.tsx (~150 functions) —
  // pulling in 167 MB of public/treatments/ photos, 18 MB of WordPress migration
  // dumps under scripts/, import/content.json, etc. That bloat (functions near the
  // 250 MB limit) wedges Vercel's "Deploying outputs" step. None of these are read
  // at runtime: next/image serves public/ as static assets, the OG renderer falls
  // back to fetching the image URL when it isn't on disk, and scripts//import/ are
  // build-time only. Fonts (assets/fonts + node_modules/geist) are NOT excluded,
  // so OG cards keep their typefaces.
  outputFileTracingExcludes: {
    '**': [
      './public/**/*',
      './scripts/**/*',
      './import/**/*',
      './audit/**/*',
      './docs/**/*',
      './*.tsbuildinfo',
    ],
  },
  // The migration runner is the one function that DOES need the WordPress dump
  // at runtime (it inflates it to /tmp; the import scripts themselves are
  // bundled into the route via its static imports).
  outputFileTracingIncludes: {
    '/api/build/migrate-wp': [
      './scripts/migrate-wp/127_0_0_1.sql.zip',
    ],
  },
  // Exposed to client + server so image paths from /public can be prefixed with
  // the Pages sub-path. next/image does NOT prepend basePath to unoptimized
  // /public images in a static export, so we do it ourselves (see treatment-images).
  // NEXT_PUBLIC_STATIC_DEMO is true ONLY in the GitHub Pages static export (no
  // /api routes). Portal forms use it to show a friendly "preview" result on a
  // 404 instead of erroring — and crucially NOT on the live site, where a real
  // API 404/503 must surface as a genuine error rather than silently faking
  // success (a 404 blip previously made the signup wizard claim "account
  // created" without creating one — clients then couldn't log in).
  env: { NEXT_PUBLIC_BASE_PATH: repoBase, NEXT_PUBLIC_STATIC_DEMO: isPages ? 'true' : '' },
  images: {
    formats: ['image/avif', 'image/webp'],
    // GitHub Pages has no image optimiser; serve images as-is.
    unoptimized: isPages,
    // Allow SVG to be served through next/image (brand logo, icons).
    dangerouslyAllowSVG: true,
    contentDispositionType: 'inline',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // BLD-577: allow next/image to optimise user-uploaded content from Vercel Blob.
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: '*.blob.vercel-storage.com' },
    ],
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
