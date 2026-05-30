import Link from 'next/link';
import type { Treatment } from '@/lib/treatments';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { ArrowIcon } from '@/components/ui/Button';

/** A premium, hover-animated treatment card. Image area is generative art —
 *  text lives in the HTML below, never baked into the artwork. */
export function TreatmentCard({ t, index = 0 }: { t: Treatment; index?: number }) {
  return (
    <Link
      href={`/${t.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[--radius-lg] border border-[--color-line] bg-[--color-bone] transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <GenerativeArt
          from={t.gradient[0]}
          to={t.gradient[1]}
          seed={index}
          className="h-full w-full transition-transform duration-[1.4s] [transition-timing-function:var(--ease-lux)] group-hover:scale-105"
        />
        <span className="absolute left-4 top-4 rounded-full bg-black/25 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
          {t.group}
        </span>
        {t.priceFrom && (
          <span className="absolute bottom-4 right-4 rounded-full bg-[--color-porcelain]/92 px-3 py-1 text-xs font-medium text-[--color-ink] backdrop-blur-sm">
            {t.priceFrom.startsWith('£') ? `from ${t.priceFrom}` : t.priceFrom}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-[family-name:var(--font-display)] text-2xl leading-tight">{t.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[--color-stone]">{t.tagline}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[--color-gold]">
          Discover
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}
