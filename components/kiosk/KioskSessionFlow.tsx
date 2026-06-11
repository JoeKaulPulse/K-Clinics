'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ResultCard, type KioskResultView } from './ResultCard';
import { ClaimReward } from './ClaimReward';
import { CameraCapture, type CapturedPhoto } from './capture/CameraCapture';
import { POSES, MAX_UPLOADS } from './capture/poses';

type Step =
  | 'welcome'
  | 'consent'
  | 'camera'
  | 'review'
  | 'analyzing'
  | 'result'
  | 'declined'
  | 'fallback';

const ANALYZING_LINES = [
  'Reading your glow…',
  'Admiring that smile…',
  'Matching treatments you might love…',
];

// The v2 mobile session: welcome → consent + 18 gate → live camera (3 poses,
// countdown, mirror frames to the storefront screen) → review → analyzing →
// annotated result → share-to-claim. Terminal 'declined' screen when the AI
// age backstop can't confirm 18+ (photos purged server-side). Falls back to
// the classic single file-input capture when the camera is unavailable.
export function KioskSessionFlow({
  token,
  secret,
  sessionId: _sessionId,
  initialStatus,
  initialResultId,
}: {
  token: string;
  secret?: string;
  sessionId: string;
  initialStatus: string;
  initialResultId: string | null;
}) {
  const [step, setStep] = useState<Step>(() => {
    if (initialStatus === 'AGE_DECLINED') return 'declined';
    if (initialResultId) return 'result';
    return 'welcome';
  });
  const [consent, setConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [shots, setShots] = useState<CapturedPhoto[]>([]);
  const [uploads, setUploads] = useState(0);
  const [retakePose, setRetakePose] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<KioskResultView | null>(null);
  const [analyzingLine, setAnalyzingLine] = useState(0);

  // Fallback (file-input) path state — reuses the classic single-photo flow.
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fallbackMode = useRef(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If we arrived with a finished result already, load it; otherwise tell the
  // storefront screen we've paired.
  useEffect(() => {
    if (initialResultId && !result) loadResult(initialResultId);
    else if (initialStatus !== 'AGE_DECLINED') postStage('paired');
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotating micro-copy on the analyzing screen.
  useEffect(() => {
    if (step !== 'analyzing') return;
    const id = setInterval(() => setAnalyzingLine((n) => (n + 1) % ANALYZING_LINES.length), 2800);
    return () => clearInterval(id);
  }, [step]);

  function postStage(stage: string, ageDeclared?: boolean): Promise<boolean> {
    return fetch(`/api/kiosk/sessions/${token}/stage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ageDeclared ? { stage, ageDeclared: true } : { stage }),
    })
      .then((r) => r.ok)
      .catch(() => false);
  }

  async function loadResult(id: string) {
    try {
      const r = await fetch(`/api/kiosk/results/${id}`).then((x) => x.json());
      if (r?.ok) { setResult(r.result); setStep('result'); }
    } catch { /* retry via poll */ }
  }

  // Consent + 18 gate: the checkbox is the consent tap; this button is the
  // separate, explicit 18+ declaration (stamps ageDeclaredAt server-side).
  async function declareAgeAndContinue() {
    if (!consent || consentBusy) return;
    setConsentBusy(true);
    setError(null);
    const ok = await postStage('consent', true);
    setConsentBusy(false);
    if (!ok) {
      setError('Couldn’t reach the clinic — check your signal and try again.');
      return;
    }
    setStep('camera');
  }

  function handlePhoto(p: CapturedPhoto) {
    setUploads((u) => u + 1);
    setShots((s) => [...s.filter((x) => x.poseIdx !== p.poseIdx), p].sort((a, b) => a.poseIdx - b.poseIdx));
  }

  async function analyze() {
    setError(null);
    setStep('analyzing');
    try {
      const res = await fetch(`/api/kiosk/sessions/${token}/analyze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setError(typeof j?.error === 'string' ? j.error : 'Something went wrong. Please try again.');
        setStep('review');
        return;
      }
      startPolling();
    } catch {
      setError('Network error. Please try again.');
      setStep('review');
    }
  }

  // ----- Fallback (file-input) path — the classic single-photo flow. -----

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function submitFallbackPhoto() {
    if (!file) return;
    setError(null);
    setStep('analyzing');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('consent', 'true');
    try {
      const res = await fetch(`/api/kiosk/sessions/${token}/photo`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setError(j?.error || 'Something went wrong. Please try again.');
        setStep('fallback');
        return;
      }
      startPolling();
    } catch {
      setError('Network error. Please try again.');
      setStep('fallback');
    }
  }

  // ----- Shared polling for the analysis outcome. -----

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  function backFromFailure() {
    if (fallbackMode.current) {
      setFile(null);
      setPreview(null);
      setStep('fallback');
    } else {
      // The camera path always has ≥1 photo before analyze — review can retake.
      setStep('review');
    }
  }

  function startPolling() {
    stopPolling();
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries++;
      try {
        const j = await fetch(`/api/kiosk/sessions/${token}`).then((x) => x.json());
        if (j?.status === 'ANALYZED' && j?.resultId) {
          stopPolling();
          loadResult(j.resultId);
        } else if (j?.status === 'AGE_DECLINED') {
          stopPolling();
          setStep('declined');
        } else if (j?.status === 'ANALYSIS_FAILED') {
          stopPolling();
          setError('We couldn\'t read those photos — try again in good light.');
          backFromFailure();
        } else if (j?.status === 'EXPIRED') {
          stopPolling();
          setError('This session expired. Please scan the code again.');
          backFromFailure();
        }
      } catch { /* keep polling */ }
      // Give up after ~90s of polling.
      if (tries > 45 && pollRef.current) {
        stopPolling();
        setError('Analysis is taking longer than expected. Please try again.');
        backFromFailure();
      }
    }, 2000);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-ink)] px-5 py-10 text-[var(--color-porcelain)]">
      {/* WELCOME */}
      {step === 'welcome' && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.3em] text-[var(--color-gold-soft)]">KClinics</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl leading-tight">
            Discover your <span className="text-[var(--color-gold-bright)]">Skin &amp; Smile</span> Score
          </h1>
          <p className="mt-4 text-[var(--color-blush)]">
            Strike three poses on the big screen, and our AI rates your skin &amp; smile and personalises treatments just for you.
          </p>
          <p className="mt-3 text-sm text-[var(--color-stone-soft)]">Takes about 60 seconds.</p>
          <button
            onClick={() => setStep('consent')}
            className="mt-8 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-ink)] transition hover:opacity-90"
          >
            Get started →
          </button>
        </motion.div>
      )}

      {/* CONSENT + 18 GATE */}
      {step === 'consent' && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Quick consent</h2>
          <p className="mt-3 text-sm text-[var(--color-blush)]">
            We’ll analyse your photo using AI provided by Anthropic. Your photo is stored securely and deleted after 30 days.
          </p>
          <p className="mt-2 text-sm text-[var(--color-blush)]">
            Photos are deleted within 30 days — and immediately if we can’t confirm you’re 18 or over.
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
          <p className="mt-4 text-center text-xs text-[var(--color-stone-soft)]">
            This experience is for adults only.
          </p>
          {error && <p className="mt-3 text-center text-sm text-[var(--color-blush)]">{error}</p>}
          <button
            disabled={!consent || consentBusy}
            onClick={declareAgeAndContinue}
            className="mt-3 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-ink)] transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {consentBusy ? 'One moment…' : 'I’m 18 or over — continue'}
          </button>
        </motion.div>
      )}

      {/* CAMERA — live pose sequence */}
      {step === 'camera' && (
        <CameraCapture
          token={token}
          secret={secret}
          startPose={retakePose ?? 0}
          singlePose={retakePose != null}
          uploadsUsed={uploads}
          photosTaken={shots.length}
          onPhoto={handlePhoto}
          onDone={() => { setRetakePose(null); setError(null); setStep('review'); }}
          onFallback={() => {
            if (shots.length > 0) { setRetakePose(null); setStep('review'); }
            else { fallbackMode.current = true; setStep('fallback'); }
          }}
          postStage={postStage}
        />
      )}

      {/* REVIEW */}
      {step === 'review' && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Looking lovely ✨</h2>
          <p className="mt-2 text-sm text-[var(--color-blush)]">Happy with these? Retake any shot, or send them off.</p>

          <div className={`mt-6 grid gap-3 ${shots.length >= 3 ? 'grid-cols-3' : shots.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {shots.map((s) => (
              <figure key={s.poseIdx} className={shots.length === 1 ? 'mx-auto w-48' : ''}>
                <img
                  src={s.dataUrl}
                  alt={POSES[s.poseIdx]?.title ?? `Pose ${s.poseIdx + 1}`}
                  className="aspect-[3/4] w-full rounded-[var(--radius-md)] object-cover"
                />
                <figcaption className="mt-1.5 text-[0.65rem] uppercase tracking-wide text-[var(--color-stone-soft)]">
                  {POSES[s.poseIdx]?.title ?? `Pose ${s.poseIdx + 1}`}
                </figcaption>
                {uploads < MAX_UPLOADS && (
                  <button
                    onClick={() => { setRetakePose(s.poseIdx); setError(null); setStep('camera'); }}
                    className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-2 text-xs text-[var(--color-gold-soft)] underline underline-offset-2 transition-colors hover:bg-[color-mix(in_oklab,var(--color-gold)_12%,transparent)]"
                  >
                    Retake
                  </button>
                )}
              </figure>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-[var(--color-blush)]">{error}</p>}

          <button
            onClick={analyze}
            disabled={shots.length === 0}
            className="mt-7 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-ink)] transition enabled:hover:opacity-90 disabled:opacity-40"
          >
            Analyse my Skin &amp; Smile ✨
          </button>
        </motion.div>
      )}

      {/* ANALYZING */}
      {step === 'analyzing' && (
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-[var(--color-gold-soft)]/30 border-t-[var(--color-gold)]" />
          <h2 className="mt-6 font-[family-name:var(--font-display)] text-2xl">Analysing your skin &amp; smile…</h2>
          <div className="relative mt-3 h-6">
            <AnimatePresence mode="wait">
              <motion.p
                key={analyzingLine}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-x-0 text-sm text-[var(--color-blush)]"
              >
                {ANALYZING_LINES[analyzingLine]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* RESULT + share-to-claim reward */}
      {step === 'result' && result && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <ResultCard result={result} />
          {result.id && <ClaimReward resultId={result.id} />}
        </motion.div>
      )}
      {step === 'result' && !result && (
        <div className="text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-[var(--color-gold-soft)]/30 border-t-[var(--color-gold)]" />
          <p className="mt-4 text-sm text-[var(--color-blush)]">Loading your result…</p>
        </div>
      )}

      {/* DECLINED — AI age backstop couldn't confirm 18+ */}
      {step === 'declined' && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.3em] text-[var(--color-gold-soft)]">KClinics</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-tight">Thanks for stopping by 💛</h2>
          <p className="mt-4 text-[var(--color-blush)]">
            This experience is for adults only, and we couldn’t be sure this time — so we haven’t created a result.
          </p>
          <p className="mt-3 text-sm text-[var(--color-blush)]">
            Every photo from your session has already been deleted.
          </p>
          <p className="mt-3 text-sm text-[var(--color-stone-soft)]">
            If you’re 18 or over, come and say hello in the clinic — we’d love to meet you.
          </p>
          <a
            href="/"
            className="mt-8 block w-full rounded-[var(--radius-md)] border border-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-gold-bright)] transition hover:opacity-90"
          >
            Explore K Clinics →
          </a>
        </motion.div>
      )}

      {/* FALLBACK — classic single file-input capture (camera unavailable) */}
      {step === 'fallback' && (
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
              onClick={submitFallbackPhoto}
              className="mt-6 w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-ink)] transition hover:opacity-90"
            >
              Use this photo →
            </button>
          )}
        </div>
      )}
    </main>
  );
}
