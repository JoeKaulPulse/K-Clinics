'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BeforeAfter } from '@/components/ui/BeforeAfter';
import type { PublicGalleryItem } from '@/lib/gallery-data';

export function PublicGallery({ items }: { items: PublicGalleryItem[] }) {
  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const [cat, setCat] = useState('All');
  const shown = cat === 'All' ? items : items.filter((i) => i.category === cat);

  return (
    <>
      {categories.length > 2 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${cat === c ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-stone-soft)]'}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((it) => (
          <StaggerItem key={it.id}>
            <figure className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
              <BeforeAfter beforeSrc={it.beforeSrc} afterSrc={it.afterSrc} className="aspect-[4/3] w-full" />
              <figcaption className="flex items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg leading-tight">{it.category}</p>
                  {it.caption && <p className="mt-1 text-sm text-[var(--color-stone)]">{it.caption}</p>}
                </div>
                {it.treatmentSlug && (
                  <Link href={`/${it.treatmentSlug}`} aria-label={`Explore ${it.category}`} className="shrink-0 text-sm font-medium text-[var(--color-gold-deep)] hover:underline">View →</Link>
                )}
              </figcaption>
            </figure>
          </StaggerItem>
        ))}
      </Stagger>

      <p className="mt-8 text-center text-xs text-[var(--color-stone)]">
        Every case shown is a real KClinics client, published with their consent. Individual results vary.
      </p>
    </>
  );
}
