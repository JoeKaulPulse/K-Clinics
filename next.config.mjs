/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    // Preserve SEO equity from the legacy site's URL structure.
    return [
      { source: '/about-kclinics', destination: '/about', permanent: true },
      { source: '/our-clinics', destination: '/contact', permanent: true },
      { source: '/cosmetology-all-treatments', destination: '/treatments', permanent: true },
      { source: '/dentistry-all-treatments', destination: '/dentistry', permanent: true },
      { source: '/kclinics-beauty-points', destination: '/membership', permanent: true },
      { source: '/personalized-high-end-treatments', destination: '/about', permanent: true },
      { source: '/individualised-treatment-plans', destination: '/about', permanent: true },
    ];
  },
};

export default nextConfig;
