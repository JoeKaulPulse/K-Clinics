'use client';

import { useState } from 'react';
import { GiftVoucherFlow } from '@/components/gift/GiftVoucherFlow';

type Pkg = { slug: string; name: string; description: string | null; pricePence: number; images: string[] };

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export function GiftPackages({ packages, physicalEnabled = false, physicalFeePence = 0 }: { packages: Pkg[]; physicalEnabled?: boolean; physicalFeePence?: number }) {
  const [selected, setSelected] = useState<Pkg | null>(null);
  if (packages.length === 0) return null;

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Choose a different gift</button>
        <GiftVoucherFlow physicalEnabled={physicalEnabled} physicalFeePence={physicalFeePence} pkg={{ slug: selected.slug, name: selected.name, pricePence: selected.pricePence }} />
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((p) => {
        const blurb = (p.description || '').split('\n').find((l) => l.trim()) || '';
        return (
          <div key={p.slug} className="flex flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)]">
            {p.images[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0]} alt={p.name} className="h-40 w-full object-cover" />
            )}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-[family-name:var(--font-display)] text-xl">{p.name}</h3>
              {blurb && <p className="mt-2 line-clamp-3 text-sm text-[var(--color-ink-soft)]">{blurb}</p>}
              <p className="mt-3 text-lg font-medium text-[var(--color-ink)]">{money(p.pricePence)}</p>
              <button onClick={() => setSelected(p)} className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-gold-deep)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-ink)]">Gift this →</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
