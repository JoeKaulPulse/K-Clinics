import { organizationLd, JsonLd } from '@/lib/seo';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/motion/PageTransition';
import { ScrollProgress } from '@/components/motion/ScrollProgress';
import { Cursor } from '@/components/motion/Cursor';
import { Intro } from '@/components/motion/Intro';
import { BackToTop } from '@/components/motion/BackToTop';
import { MotionProvider } from '@/components/motion/MotionProvider';

// Marketing chrome: header, footer, scroll/cursor flourishes, page transitions.
// (The /admin area uses its own layout without any of this.)
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <Intro />
      <JsonLd data={organizationLd()} />
      <ScrollProgress />
      <Cursor />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--color-ink)] focus:px-5 focus:py-3 focus:text-[var(--color-porcelain)]"
      >
        Skip to content
      </a>
      <Header />
      <main id="main">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <BackToTop />
    </MotionProvider>
  );
}
