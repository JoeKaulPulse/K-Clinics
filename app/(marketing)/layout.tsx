import { organizationLd, websiteLd, JsonLd } from '@/lib/seo';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { PageTransition } from '@/components/motion/PageTransition';
import { ScrollProgress } from '@/components/motion/ScrollProgress';
import { Cursor } from '@/components/motion/Cursor';
import { Intro } from '@/components/motion/Intro';
import { BackToTop } from '@/components/motion/BackToTop';
import { WhatsAppButton } from '@/components/layout/WhatsAppButton';
import { LiveChat } from '@/components/chat/LiveChat';
import { MotionProvider } from '@/components/motion/MotionProvider';
import { CookieConsent } from '@/components/legal/CookieConsent';
import { TrackingScripts } from '@/components/marketing/TrackingScripts';
import { BehaviorRecorder } from '@/components/marketing/BehaviorRecorder';
import { EditBar } from '@/components/admin/EditBar';
import { getSiteConfig, announcementActive } from '@/lib/site-config';
import { getTrackingConfig, hasAnyTracking } from '@/lib/tracking';

// Marketing chrome: header, footer, scroll/cursor flourishes, page transitions.
// (The /admin area uses its own layout without any of this.)
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [config, tracking] = await Promise.all([getSiteConfig(), getTrackingConfig()]);
  return (
    <MotionProvider>
      <Intro />
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <ScrollProgress />
      <Cursor />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--color-ink)] focus:px-5 focus:py-3 focus:text-[var(--color-porcelain)]"
      >
        Skip to content
      </a>
      <AnnouncementBar a={config.announcement} active={announcementActive(config.announcement)} />
      <Header config={config} />
      <main id="main" className="pt-[var(--ann-h,0px)]">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer config={config} />
      <BackToTop />
      <WhatsAppButton config={config} />
      <LiveChat />
      <EditBar />
      <CookieConsent />
      {hasAnyTracking(tracking) && <TrackingScripts {...tracking} />}
      <BehaviorRecorder />
    </MotionProvider>
  );
}
