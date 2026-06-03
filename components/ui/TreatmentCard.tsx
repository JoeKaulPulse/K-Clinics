import Link from 'next/link';
import type { Treatment } from '@/lib/treatments';
import { MediaArt } from '@/components/ui/MediaArt';
import { treatmentImage } from '@/lib/treatment-images';
import { ArrowIcon } from '@/components/ui/Button';
import { Tilt } from '@/components/motion/Tilt';
import { pricingByTreatment, fromLabel, formatPence, statusLabel, type ServiceStatus } from '@/lib/services';

/** A premium, hover-animated treatment card with 3D tilt + glare. Uses the real
 *  photo when available, else generative art — text lives in HTML, never baked in.
 *  The "from" price + presentation status are derived live from the admin
 *  catalogue (never hardcoded). */
export async function TreatmentCard({ t, index = 0 }: { t: Treatment; index?: number }) {
  const pricing = (await pricingByTreatment()).get(t.slug) ?? null;
  let status: ServiceStatus = pricing?.status ?? 'NORMAL';
  if (status === 'NORMAL' && t.onRequest) status = 'COMING_SOON'; // machine not in yet (code-level)
  const fromPence = pricing?.fromPence ?? null;
  const fromOfferPence = pricing?.fromOfferPence ?? null;
  return (
    <Tilt className="h-full">
      <Link
        href={`/${t.slug}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] transition-[transform,box-shadow] duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--color-gold)_45%,var(--color-line))] hover:shadow-[var(--shadow-lift)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <MediaArt
            src={treatmentImage(t.slug)}
            from={t.gradient[0]}
            to={t.gradient[1]}
            seed={index}
            alt={t.title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="h-full w-full transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-[1.08]"
          />
          <span className="absolute left-4 top-4 rounded-full bg-black/25 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/90 backdrop-blur-sm">
            {t.group}
          </span>
          {status === 'COMING_SOON' || status === 'UNAVAILABLE' ? (
            <span className="absolute bottom-4 right-4 rounded-full bg-[var(--color-gold-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)] backdrop-blur-sm">
              {statusLabel(status)}
            </span>
          ) : status === 'CONSULTATION' ? (
            <span className="absolute bottom-4 right-4 rounded-full bg-[var(--color-porcelain)]/92 px-3 py-1 text-xs font-medium text-[var(--color-ink)] backdrop-blur-sm">
              On consultation
            </span>
          ) : fromOfferPence != null && fromPence != null ? (
            <span className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-[var(--color-porcelain)]/92 px-3 py-1 text-xs font-medium text-[var(--color-ink)] backdrop-blur-sm">
              <span className="rounded-full bg-[var(--color-gold)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white">Offer</span>
              <span className="text-[var(--color-stone-soft)] line-through">{formatPence(fromPence)}</span>
              <span>from {formatPence(fromOfferPence)}</span>
            </span>
          ) : fromPence != null ? (
            <span className="absolute bottom-4 right-4 rounded-full bg-[var(--color-porcelain)]/92 px-3 py-1 text-xs font-medium text-[var(--color-ink)] backdrop-blur-sm">
              {fromLabel(fromPence)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-7">
          <h3 className="font-[family-name:var(--font-display)] text-2xl leading-tight transition-colors duration-500 group-hover:text-[var(--color-gold)]">
            {t.title}
          </h3>
          <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[var(--color-stone)]">{t.tagline}</p>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-gold)]">
            <span className="relative">
              Discover
              <span className="absolute -bottom-0.5 left-0 h-px w-full origin-right scale-x-0 bg-current transition-transform duration-500 [transition-timing-function:var(--ease-lux)] group-hover:origin-left group-hover:scale-x-100" />
            </span>
            <ArrowIcon />
          </span>
        </div>
      </Link>
    </Tilt>
  );
}
