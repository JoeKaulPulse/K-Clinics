import { ScoreRing } from './ScoreRing';
import { ShareButtons } from './ShareButtons';

export type KioskResultView = {
  id?: string | null;
  headline: string;
  skinScore: number;
  smileScore: number;
  insights: string[];
  treatments: string[];
  shareSlug: string;
};

// The branded result card — shared by the live mobile flow (step 5) and the
// public shareable page. `claimHref` is shown only in the live flow.
export function ResultCard({
  result,
  origin,
  claimHref,
  showShare = true,
}: {
  result: KioskResultView;
  origin?: string;
  claimHref?: string;
  showShare?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 shadow-xl">
      <p className="text-center font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.3em] text-[var(--color-gold)]">
        KClinics · Skin &amp; Smile
      </p>
      <h1 className="mt-3 text-center font-[family-name:var(--font-display)] text-2xl leading-snug text-[var(--color-ink)]">
        {result.headline}
      </h1>

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
            origin={origin}
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
