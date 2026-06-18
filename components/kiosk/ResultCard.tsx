'use client';

import { useState } from 'react';
import { ScoreRing } from './ScoreRing';
import { ShareButtons } from './ShareButtons';

export type KioskAnnotation = {
  area?: 'skin' | 'smile' | string;
  photoIndex?: number;
  label: string;
  detail?: string;
  box: { x: number; y: number; w: number; h: number };
  confidence?: number;
};

export type KioskResultView = {
  id?: string | null;
  headline: string;
  skinScore: number;
  smileScore: number;
  insights: string[];
  treatments: string[];
  shareSlug: string;
  // v2 fields — session-scoped only; never returned on the public share page.
  annotations?: KioskAnnotation[] | null;
  shareCaption?: string | null;
  bestPhotoUrl?: string | null;
};

// The branded result card — shared by the live mobile flow (step 5) and the
// public shareable page. `claimHref` is shown only in the live flow. When the
// v2 result carries annotations + bestPhotoUrl (live session only), the card
// shows the annotated photo; otherwise it falls back to the classic layout.
export function ResultCard({
  result,
  origin,
  claimHref,
  showShare = true,
  onShared,
}: {
  result: KioskResultView;
  origin?: string;
  claimHref?: string;
  showShare?: boolean;
  /** Bubbled up from ShareButtons after any successful share action. */
  onShared?: () => void;
}) {
  const annotations = (result.annotations ?? []).filter(
    (a) =>
      a && typeof a.label === 'string' && a.box &&
      [a.box.x, a.box.y, a.box.w, a.box.h].every((n) => typeof n === 'number' && Number.isFinite(n)),
  );
  const showAnnotated = Boolean(result.bestPhotoUrl) && annotations.length > 0;

  return (
    <div className="mx-auto w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 shadow-xl">
      <p className="text-center font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.3em] text-[var(--color-gold)]">
        KClinics · Skin &amp; Smile
      </p>
      <h1 className="mt-3 text-center font-[family-name:var(--font-display)] text-2xl leading-snug text-[var(--color-ink)]">
        {result.headline}
      </h1>

      {showAnnotated && result.bestPhotoUrl && (
        <AnnotatedPhoto src={result.bestPhotoUrl} annotations={annotations} />
      )}

      <div className="mt-6 flex justify-center gap-8">
        <ScoreRing label="Skin" score={result.skinScore} />
        <ScoreRing label="Smile" score={result.smileScore} />
      </div>

      {result.insights.length > 0 && (
        <ul className="mt-6 space-y-2">
          {result.insights.map((ins, i) => (
            <li key={i} className="flex gap-2 text-sm text-[var(--color-ink)]">
              <span className="text-[var(--color-gold)]">✦</span>
              <span>{ins}</span>
            </li>
          ))}
        </ul>
      )}

      {result.treatments.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Personalised for you</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.treatments.map((t) => (
              <span key={t} className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-sm text-[var(--color-ink)]">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {showShare && (
        <div className="mt-7">
          <p className="mb-3 text-center text-sm font-medium text-[var(--color-ink)]">Share your score ✨</p>
          <ShareButtons
            resultId={result.id ?? null}
            shareSlug={result.shareSlug}
            skinScore={result.skinScore}
            shareCaption={result.shareCaption}
            origin={origin}
            onShared={onShared}
          />
        </div>
      )}

      {claimHref && (
        <a
          href={claimHref}
          className="mt-6 block rounded-[var(--radius-md)] bg-[var(--color-ink)] px-4 py-4 text-center text-base font-medium text-[var(--color-porcelain)] transition hover:opacity-90"
        >
          Claim your reward →
        </a>
      )}
    </div>
  );
}

// The annotated best photo: SVG boxes over the image (normalized 0–1 coords →
// displayed rect) plus numbered, tappable labels beneath — tapping a label
// highlights its box (and dims the rest) for easy reading on a phone.
function AnnotatedPhoto({ src, annotations }: { src: string; annotations: KioskAnnotation[] }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="mt-5">
      <div className="relative overflow-hidden rounded-[var(--radius-md)]">
        <img src={src} alt="Your best shot, annotated" className="block w-full" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full">
          {annotations.map((a, i) => {
            const dim = active !== null && active !== i;
            const hot = active === i;
            return (
              <rect
                key={i}
                x={a.box.x * 100}
                y={a.box.y * 100}
                width={a.box.w * 100}
                height={a.box.h * 100}
                rx={2}
                ry={2}
                fill="none"
                stroke={hot ? 'var(--color-gold-bright)' : 'var(--color-gold)'}
                strokeWidth={hot ? 3 : 1.5}
                vectorEffect="non-scaling-stroke"
                style={{ opacity: dim ? 0.25 : 1, transition: 'opacity 0.3s var(--ease-lux), stroke-width 0.3s var(--ease-lux)' }}
              />
            );
          })}
        </svg>
        {/* Numbered badges at each box corner (HTML so they stay circular) */}
        {annotations.map((a, i) => {
          const dim = active !== null && active !== i;
          return (
            <button
              key={i}
              onClick={() => setActive(active === i ? null : i)}
              aria-label={`Highlight: ${a.label}`}
              className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-gold)] text-xs font-semibold text-[var(--color-ink)] shadow transition-opacity"
              style={{ left: `${a.box.x * 100}%`, top: `${a.box.y * 100}%`, opacity: dim ? 0.35 : 1 }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-3 space-y-2">
        {annotations.map((a, i) => {
          const hot = active === i;
          return (
            <button
              key={i}
              onClick={() => setActive(hot ? null : i)}
              className={`w-full rounded-[var(--radius-sm)] border p-3 text-left transition ${
                hot
                  ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10'
                  : 'border-[var(--color-line)] bg-white/40'
              }`}
            >
              <span className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)] text-[0.65rem] font-semibold text-[var(--color-ink)]">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-medium text-[var(--color-ink)]">{a.label}</span>
                  {a.detail && <span className="mt-0.5 block text-xs text-[var(--color-stone)]">{a.detail}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
