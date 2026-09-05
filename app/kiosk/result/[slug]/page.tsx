import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { ResultCard } from '@/components/kiosk/ResultCard';
import { ShareViewTracker } from '@/components/kiosk/ShareViewTracker';
import { CookieConsent } from '@/components/legal/CookieConsent';
import { TrackingScripts } from '@/components/marketing/TrackingScripts';
import { getTrackingConfig, hasAnyTracking } from '@/lib/tracking';

// Public, cacheable shareable card. Never shows the photo (privacy).
export const dynamic = 'force-static';
export const revalidate = 3600;

async function getResult(slug: string) {
  return db.kioskResult.findUnique({
    where: { shareSlug: slug },
    select: { id: true, headline: true, skinScore: true, smileScore: true, insights: true, treatments: true, shareSlug: true },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getResult(slug);
  if (!result) return { title: 'Skin & Smile Score — KClinics' };
  const title = `${result.headline} — KClinics Skin & Smile`;
  const description = `Skin ${result.skinScore}/10 · Smile ${result.smileScore}/10. Get your own AI skin & smile score at K Clinics.`;
  // BLD-1636: the branded share card already exists at /api/kiosk/results/[id]/card
  // (used by the native Web Share flow, components/kiosk/ShareButtons.tsx) but was
  // never wired into generateMetadata, so WhatsApp/iMessage/Slack/Facebook shares
  // of this page unfurled with no image.
  const cardUrl = `/api/kiosk/results/${result.id}/card`;
  const canonical = `/kiosk/result/${slug}`;
  return {
    title,
    description,
    // BLD-1624: this route lives under app/kiosk (in-store surfaces, correctly
    // noindex via app/kiosk/layout.tsx), but this specific page is the public
    // shareable card — the whole point is a friend's link bringing in a new
    // visitor, so it needs to be indexable, unlike its in-store siblings.
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical, images: [{ url: cardUrl, width: 1080, height: 1350, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [cardUrl] },
  };
}

export default async function KioskResultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [result, tracking] = await Promise.all([getResult(slug), getTrackingConfig()]);
  if (!result) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-ink)] px-5 py-10">
      <ResultCard result={result} showShare claimHref={`/account/signup?ref=kiosk&slug=${result.shareSlug}`} />
      <Link
        href="/kiosk/display"
        className="text-sm text-[var(--color-gold-soft)] underline underline-offset-4 hover:text-[var(--color-gold)]"
      >
        Try the Skin &amp; Smile scanner →
      </Link>
      {/* The cookie banner lives in the marketing layout, which this route group
          does not use — without it a first-time visitor arriving from a shared
          link has no way to opt in, so TrackingScripts and ShareViewTracker
          (both consent-gated) would never fire for exactly the audience this
          page exists to reach. */}
      <CookieConsent />
      {hasAnyTracking(tracking) && <TrackingScripts {...tracking} />}
      <ShareViewTracker />
    </main>
  );
}
