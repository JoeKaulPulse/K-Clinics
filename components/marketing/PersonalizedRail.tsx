'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { treatments, hiddenAudiences, type Treatment } from '@/lib/treatments';
import { segmentFromCookieString, segmentFromUrl, type Segment } from '@/lib/personalize';
import { Button, ArrowIcon } from '@/components/ui/Button';

// Renders a treatments rail prioritised for the visitor's declared segment
// (from ?seg= or the kc_seg cookie). Falls back to a neutral popular set when
// no segment is known, so it's always useful. Client-side so cached pages stay
// correct per-visitor.
export function PersonalizedRail({ heading, subheading, count = 6, showGiftCard = true }: { heading?: string; subheading?: string; count?: number; showGiftCard?: boolean }) {
  const [seg, setSeg] = useState<Segment | null>(null);

  useEffect(() => {
    const fromUrl = typeof window !== 'undefined' ? segmentFromUrl(new URL(window.location.href)) : null;
    setSeg(fromUrl ?? segmentFromCookieString(document.cookie));
  }, []);

  const ordered = orderForSegment(seg).slice(0, count);
  if (!ordered.length) return null;

  return (
    <section className="container-lux section">
      <div className="mb-8 max-w-xl">
        {heading && <h2 className="text-title">{heading}</h2>}
        {subheading && <p className="mt-3 text-[var(--color-stone)]">{subheading}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((t) => (
          <Link key={t.slug} href={`/${t.slug}`} className="group rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 transition-colors hover:border-[var(--color-gold)]">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">{t.group}</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl transition-colors group-hover:text-[var(--color-gold-deep)]">{t.title}</h3>
            {t.tagline && <p className="mt-2 text-sm text-[var(--color-stone)]">{t.tagline}</p>}
          </Link>
        ))}
      </div>
      {showGiftCard && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/30 bg-gradient-to-br from-[var(--color-gold)]/8 to-transparent p-6">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-xl">{seg === 'male' ? 'The perfect gift for him' : seg === 'female' ? 'The perfect gift for her' : 'Give the gift of glow'}</h3>
            <p className="mt-1 text-sm text-[var(--color-stone)]">A KClinics gift voucher — redeemable across every treatment.</p>
          </div>
          <Button href="/gift-vouchers" variant="gold">Shop gift vouchers <ArrowIcon /></Button>
        </div>
      )}
    </section>
  );
}

function orderForSegment(seg: Segment | null): Treatment[] {
  const live = treatments.filter((t) => !t.onRequest);
  if (!seg) return live.filter((t) => (t.audience ?? 'all') === 'all');
  const hide = hiddenAudiences(seg); // audiences not relevant to this visitor
  const relevant = live.filter((t) => !hide.includes((t.audience ?? 'all') as 'male' | 'female'));
  // Segment-specific treatments first, then neutral ones.
  return [
    ...relevant.filter((t) => t.audience === seg),
    ...relevant.filter((t) => (t.audience ?? 'all') === 'all'),
  ];
}
