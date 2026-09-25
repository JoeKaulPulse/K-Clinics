import Link from 'next/link';
import { Reveal } from '@/components/motion/Reveal';
import { formatFee, type BundleView } from '@/lib/academy';
import { getActivePromo } from '@/lib/academy-utils';

// One learning-pathway (bundle) card. Shared by the "Learning pathways" section
// on /academy and the /academy/bundles index (BLD-1933) so the two can't drift.
// `heading` sets the title level: h3 under the /academy section heading, h2 on
// the index page where the cards sit directly under the page h1.
export function BundleCard({ bundle: b, heading: H = 'h3' }: { bundle: BundleView; heading?: 'h2' | 'h3' }) {
  const bp = getActivePromo(b);
  return (
    <Reveal>
      <Link href={`/academy/bundles/${b.slug}`} className="group flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-ink)] p-6 text-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)]">
        <span className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold-soft)]">{b.courses.length} course{b.courses.length === 1 ? '' : 's'} · pathway</span>
        <H className="mt-1 font-[family-name:var(--font-display)] text-xl leading-tight">{b.title}</H>
        {b.summary && <p className="mt-2 flex-1 text-sm text-[var(--color-porcelain)]/75">{b.summary}</p>}
        <div className="mt-4 flex items-center justify-between">
          {/* BLD-1376: show a live bundle promo with the standard price struck through. */}
          {bp != null ? (
            <span className="text-sm font-medium text-[var(--color-gold-soft)]">
              {formatFee(bp)}{' '}
              {b.pricePence != null && b.pricePence > bp && <s className="ml-1 font-normal text-[var(--color-porcelain)]/55">{formatFee(b.pricePence)}</s>}
            </span>
          ) : (
            <span className="text-sm font-medium">{b.pricePence != null ? formatFee(b.pricePence) : 'On enquiry'}</span>
          )}
          <span className="text-sm text-[var(--color-gold-soft)] group-hover:underline">View pathway →</span>
        </div>
      </Link>
    </Reveal>
  );
}
