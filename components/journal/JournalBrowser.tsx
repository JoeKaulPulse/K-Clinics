'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Stagger, StaggerItem, Reveal } from '@/components/motion/Reveal';
import { MediaArt } from '@/components/ui/MediaArt';

export type JournalCard = {
  slug: string; title: string; excerpt: string; category: string;
  readMinutes: number; published: string; image: string | null;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function JournalBrowser({ articles }: { articles: JournalCard[] }) {
  const categories = useMemo(() => ['All', ...Array.from(new Set(articles.map((a) => a.category)))], [articles]);
  const [cat, setCat] = useState('All');

  const filtered = cat === 'All' ? articles : articles.filter((a) => a.category === cat);
  const [lead, ...rest] = filtered;

  return (
    <>
      {/* Category filter */}
      <Reveal>
        <div className="mb-10 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${cat === c ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-stone-soft)]'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Lead article */}
      {lead && (
        <Reveal key={lead.slug}>
          <Link href={`/journal/${lead.slug}`} className="group grid overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] md:grid-cols-[1.1fr_1fr]">
            <div className="relative min-h-[16rem] overflow-hidden">
              <MediaArt src={lead.image} from="#a98a6d" to="#3d352f" alt={lead.title} className="h-full w-full transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.05]" />
            </div>
            <div className="flex flex-col justify-center p-8 md:p-12">
              <p className="eyebrow mb-3">{lead.category} · {lead.readMinutes} min read</p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-[2.5rem] md:leading-[1.05]">{lead.title}</h2>
              <p className="mt-4 max-w-xl leading-relaxed text-[var(--color-stone)]">{lead.excerpt}</p>
              <span className="mt-6 text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">{fmtDate(lead.published)}</span>
            </div>
          </Link>
        </Reveal>
      )}

      {/* Grid */}
      <Stagger className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((a) => (
          <StaggerItem key={a.slug}>
            <Link href={`/journal/${a.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]">
              <div className="relative aspect-[3/2] overflow-hidden">
                <MediaArt src={a.image} from="#a98a6d" to="#7b6a5d" alt={a.title} className="h-full w-full transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.06]" />
                <span className="absolute left-3 top-3 rounded-full bg-[color-mix(in_oklab,var(--color-ink)_72%,transparent)] px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[var(--color-porcelain)] backdrop-blur">{a.category}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="eyebrow mb-2 text-xs">{a.readMinutes} min read</p>
                <h3 className="font-[family-name:var(--font-display)] text-xl leading-tight">{a.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-stone)]">{a.excerpt}</p>
                <span className="mt-auto pt-4 text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">{fmtDate(a.published)}</span>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      {filtered.length === 0 && <p className="text-center text-[var(--color-stone)]">No articles in this category yet.</p>}
    </>
  );
}
