'use client';

import { useEffect, useState } from 'react';
import { Button, ArrowIcon } from '@/components/ui/Button';

type Fallback = { headline?: string; subhead?: string; ctaLabel?: string; ctaHref?: string };
type Variant = { headline?: string; subhead?: string; ctaLabel?: string; ctaHref?: string } | null;

// Renders an A/B-tested hero block. Assigns a sticky variant via /api/ab and
// records a conversion when the CTA is clicked. Falls back to the section's own
// copy when the test isn't running.
export function AbBlock({ slug, fallback }: { slug: string; fallback: Fallback }) {
  const [v, setV] = useState<Variant>(undefined as unknown as Variant);

  useEffect(() => {
    if (!slug) { setV(null); return; }
    let live = true;
    fetch('/api/ab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'expose', slug }) })
      .then((r) => r.json())
      .then((d) => { if (live) setV(d?.ok ? d : null); })
      .catch(() => { if (live) setV(null); });
    return () => { live = false; };
  }, [slug]);

  // Until assigned, show fallback to avoid layout shift / blank flash.
  const content = v && (v.headline || v.subhead) ? v : fallback;
  const headline = content.headline || fallback.headline || '';
  const subhead = content.subhead || fallback.subhead || '';
  const ctaLabel = content.ctaLabel || fallback.ctaLabel || 'Book now';
  const ctaHref = content.ctaHref || fallback.ctaHref || '/book';

  function onCta() {
    // Record the conversion (fire-and-forget) before navigating.
    if (slug) navigator.sendBeacon?.('/api/ab', new Blob([JSON.stringify({ op: 'convert', slug })], { type: 'application/json' }));
  }

  if (!headline && !subhead) return null;

  return (
    <section className="surface-ink grain relative overflow-hidden">
      <div className="container-lux section text-center">
        {headline && <h2 className="text-display mx-auto max-w-3xl text-[var(--color-porcelain)]">{headline}</h2>}
        {subhead && <p className="mx-auto mt-5 max-w-xl text-lg text-[color-mix(in_oklab,var(--color-porcelain)_78%,transparent)]">{subhead}</p>}
        <div className="mt-8 flex justify-center">
          <Button href={ctaHref} variant="gold" size="lg" onClick={onCta}>{ctaLabel} <ArrowIcon /></Button>
        </div>
      </div>
    </section>
  );
}
