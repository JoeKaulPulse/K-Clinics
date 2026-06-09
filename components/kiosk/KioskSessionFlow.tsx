'use client';

import { useEffect, useRef, useState } from 'react';
import { ResultCard, type KioskResultView } from './ResultCard';

type Step = 1 | 2 | 3 | 4 | 5;

// The mobile session: welcome → consent → capture → processing → result.
export function KioskSessionFlow({
  token,
  sessionId,
  initialStatus,
  initialResultId,
}: {
  token: string;
  sessionId: string;
  initialStatus: string;
  initialResultId: string | null;
}) {
  const [step, setStep] = useState<Step>(initialResultId ? 5 : 1);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KioskResultView | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If we arrived with a finished result already, load it.
  useEffect(() => {
    if (initialResultId && !result) loadResult(initialResultId);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadResult(id: string) {
    try {
      const r = await fetch(`/api/kiosk/results/${id}`).then((x) => x.json());
      if (r?.ok) { setResult(r.result); setStep(5); }
    } catch { /* retry via poll */ }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function submitPhoto() {
    if (!file) return;
    setError(null);
    setStep(4);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('consent', 'true');
    try {
      const res = await fetch(`/api/kiosk/sessions/${token}/photo`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setError(j?.error || 'Something went wrong. Please try again.');
        setStep(3);
        return;
      }
      startPolling();
    } catch {
      setError('Network error. Please try again.');
      setStep(3);
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries++;
      try {
        const j = await fetch(`/api/kiosk/sessions/${token}`).then((x) => x.json());
        if (j?.status === 'ANALYZED' && j?.resultId) {
          if (pollRef.current) clearInterval(pollRef.current);
          loadResult(j.resultId);
        } else if (j?.status === 'EXPIRED') {
          if (pollRef.current) clearInterval(pollRef.current);
          setError('This session expired. Please scan the code again.');
          setStep(3);
        }
      } catch { /* keep polling */ }
      // Give up after ~60s of polling.
      if (tries > 30) {
        if (pollRef.current) clearInterval(pollRef.current);
        setError('Analysis is taking longer than expected. Please try again.');
        setStep(3);
      }
    }, 2000);
  }

  const claimHref = result ? `/account/register?ref=kiosk&slug=${result.shareSlug}` : '#';

  function onClaimClick() {
    if (result) fetch('/api/kiosk/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'claimed', sessionId }),
    }).catch(() => {});
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-ink)] px-5 py-10 text-[var(--color-porcelain)]">
      {/* STEP 1 — Welcome */}
      {step === 1 && (
        <div className="w-full max-w-sm text-center">
          <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.3em] text-[var(--color-gold-soft)]">KClinics</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl leading-tight">
            Discover your <span className="text-[var(--color-gold-bright)]">Skin &amp; Smile</span> Score
          </h1>
          <p className="mt-4 text-[var(--color-blush)]">
            In 30 seconds, our AI rates your skin &amp; smile and personalises treatments just for you.
          </p>
          <button
            onClick={() => setStep(2)}
            className="mt-8 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-ink)] transition hover:opacity-90"
          >
            Get started →
          </button>
        </div>
      )}

      {/* STEP 2 — Consent */}
      {step === 2 && (
        <div className="w-full max-w-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Quick consent</h2>
          <p className="mt-3 text-sm text-[var(--color-blush)]">
            We’ll analyse your photo with AI. Your photo is stored securely and deleted after 30 days.
          </p>
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-gold-soft)]/40 p-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--color-gold)]"
            />
            <span className="text-sm">
              I agree to share my photo for AI analysis and consent to my result being shown on this device.
            </span>
          </label>
          <button
            disabled={!consent}
            onClick={() => setStep(3)}
            className="mt-6 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-ink)] transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue →
          </button>
        </div>
      )}

      {/* STEP 3 — Capture */}
      {step === 3 && (
        <div className="w-full max-w-sm text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Take your selfie</h2>
          <p className="mt-2 text-sm text-[var(--color-blush)]">Look straight at the camera in good light.</p>

          {preview ? (
            <img src={preview} alt="Your selfie preview" className="mx-auto mt-6 h-56 w-56 rounded-[var(--radius-lg)] object-cover" />
          ) : (
            <div className="mx-auto mt-6 flex h-56 w-56 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-gold-soft)]/50 text-5xl">
              📸
            </div>
          )}

          {error && <p className="mt-4 text-sm text-[var(--color-blush)]">{error}</p>}

          <label className="mt-6 block w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-gold-bright)]">
            {preview ? 'Retake photo' : 'Open camera'}
            <input type="file" accept="image/*" capture="user" onChange={onPick} className="hidden" />
          </label>

          <label className="mt-3 block w-full cursor-pointer text-sm text-[var(--color-stone-soft)] underline">
            or choose from gallery
            <input type="file" accept="image/*" onChange={onPick} className="hidden" />
          </label>

          {preview && (
            <button
              onClick={submitPhoto}
              className="mt-6 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-ink)] transition hover:opacity-90"
            >
              Use this photo →
            </button>
          )}
        </div>
      )}

      {/* STEP 4 — Processing */}
      {step === 4 && (
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-[var(--color-gold-soft)]/30 border-t-[var(--color-gold)]" />
          <h2 className="mt-6 font-[family-name:var(--font-display)] text-2xl">Analysing your skin &amp; smile…</h2>
          <p className="mt-2 text-sm text-[var(--color-blush)]">Our AI is working its magic. Just a moment.</p>
        </div>
      )}

      {/* STEP 5 — Result */}
      {step === 5 && result && (
        <div className="w-full" onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest('a[href*="register"]')) onClaimClick();
        }}>
          <ResultCard result={result} claimHref={claimHref} />
        </div>
      )}
      {step === 5 && !result && (
        <div className="text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-[var(--color-gold-soft)]/30 border-t-[var(--color-gold)]" />
          <p className="mt-4 text-sm text-[var(--color-blush)]">Loading your result…</p>
        </div>
      )}
    </main>
  );
}
