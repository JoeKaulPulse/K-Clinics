import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ResultCard } from '@/components/kiosk/ResultCard';

// Public, cacheable shareable card. Never shows the photo (privacy).
export const dynamic = 'force-static';
export const revalidate = 3600;

async function getResult(slug: string) {
  return db.kioskResult.findUnique({
    where: { shareSlug: slug },
    select: { headline: true, skinScore: true, smileScore: true, insights: true, treatments: true, shareSlug: true },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getResult(slug);
  if (!result) return { title: 'Skin & Smile Score — KClinics' };
  const title = `${result.headline} — KClinics Skin & Smile`;
  const description = `Skin ${result.skinScore}/10 · Smile ${result.smileScore}/10. Get your own AI skin & smile score at K Clinics.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function KioskResultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getResult(slug);
  if (!result) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-ink)] px-5 py-10">
      <ResultCard result={result} showShare claimHref={`/account/register?ref=kiosk&slug=${result.shareSlug}`} />
      <a
        href="/kiosk/display"
        className="text-sm text-[var(--color-gold-soft)] underline underline-offset-4 hover:text-[var(--color-gold)]"
      >
        Try the Skin &amp; Smile scanner →
      </a>
    </main>
  );
}
