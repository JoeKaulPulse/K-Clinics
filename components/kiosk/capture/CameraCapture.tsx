'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { POSES, MAX_UPLOADS } from './poses';

export type CapturedPhoto = { poseIdx: number; dataUrl: string };

const FRAME_INTERVAL_MS = 400; // mirror-frame cadence to the storefront screen
const FRAME_WIDTH = 480; //      mirror-frame width (jpeg q0.6 keeps it ≤120KB)
const CAPTURE_MAX_WIDTH = 1280; // full-res capture cap (jpeg q0.85)

type Phase = 'starting' | 'posing' | 'countdown' | 'captured';

// The live camera experience: getUserMedia preview (mirrored), 3-pose sequence
// with 3-2-1 countdown, mirror-frame streaming to the storefront display, and
// full-res (unmirrored) capture uploaded per pose. Falls back to the file-input
// path via `onFallback` when the camera is denied/unavailable.
export function CameraCapture({
  token,
  startPose = 0,
  singlePose = false,
  uploadsUsed = 0,
  photosTaken = 0,
  onPhoto,
  onDone,
  onFallback,
  postStage,
}: {
  token: string;
  /** Pose to start at (used for retakes from the review screen). */
  startPose?: number;
  /** Capture just `startPose`, then finish (retake mode). */
  singlePose?: boolean;
  /** Photos already uploaded this session — caps retakes at the server max. */
  uploadsUsed?: number;
  /** Distinct poses already captured (enables Skip after pose 1). */
  photosTaken?: number;
  onPhoto: (photo: CapturedPhoto) => void;
  onDone: () => void;
  onFallback: () => void;
  postStage: (stage: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameBusy = useRef(false); //   skip mirror frames while one is in flight
  const captureBusy = useRef(false);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ready, setReady] = useState(false);
  const [poseIdx, setPoseIdx] = useState(startPose);
  const [phase, setPhase] = useState<Phase>('starting');
  const [count, setCount] = useState(3);
  const [flash, setFlash] = useState(false);
  const [shot, setShot] = useState<CapturedPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState(uploadsUsed);
  const [error, setError] = useState<string | null>(null);

  const pose = POSES[Math.min(poseIdx, POSES.length - 1)];
  const lastPose = poseIdx >= POSES.length - 1;
  const canRetake = uploads < MAX_UPLOADS;
  const canSkip = phase === 'posing' && !singlePose && poseIdx > 0 && photosTaken > 0;

  // Start the camera once; stop every track on unmount (battery + privacy).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setReady(true);
        setPhase('posing');
        postStage('posing');
      } catch {
        if (!cancelled) onFallback(); // denied / no camera → file-input path
      }
    })();
    return () => {
      cancelled = true;
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror-frame streaming to the display — only while posing/countdown
  // (battery-respectful: stops outside those phases and on unmount).
  useEffect(() => {
    if (!ready || (phase !== 'posing' && phase !== 'countdown')) return;
    const id = setInterval(sendFrame, FRAME_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phase]);

  function sendFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || frameBusy.current) return;
    const canvas = (frameCanvasRef.current ??= document.createElement('canvas'));
    canvas.width = FRAME_WIDTH;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * FRAME_WIDTH);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Flip horizontally so the storefront screen behaves like a true mirror.
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    const frame = canvas.toDataURL('image/jpeg', 0.6);
    frameBusy.current = true;
    fetch(`/api/kiosk/sessions/${token}/frame`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frame }),
      keepalive: false,
    })
      .catch(() => {}) // fire-and-forget — a dropped frame is fine
      .finally(() => { frameBusy.current = false; });
  }

  function startCountdown() {
    if (phase !== 'posing') return;
    postStage('countdown');
    setError(null);
    setPhase('countdown');
    setCount(3);
    let n = 3;
    countdownTimer.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        countdownTimer.current = null;
        void capture();
      } else {
        setCount(n);
      }
    }, 1000);
  }

  // Full-res (≤1280px, unmirrored) capture → POST /photos with the poseIdx.
  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || captureBusy.current) {
      setPhase('posing');
      return;
    }
    captureBusy.current = true;
    setFlash(true);
    setTimeout(() => setFlash(false), 380);
    try {
      const w = Math.min(video.videoWidth, CAPTURE_MAX_WIDTH);
      const h = Math.round((video.videoHeight / video.videoWidth) * w);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(video, 0, 0, w, h); // unmirrored — this is the real photo
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) throw new Error('capture');

      setShot({ poseIdx, dataUrl });
      setPhase('captured');
      setUploading(true);

      const fd = new FormData();
      fd.append('file', new File([blob], `pose-${poseIdx}.jpg`, { type: 'image/jpeg' }));
      fd.append('poseIdx', String(poseIdx));
      const res = await fetch(`/api/kiosk/sessions/${token}/photos`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'upload');

      postStage('captured');
      setUploads((u) => u + 1);
      onPhoto({ poseIdx, dataUrl });
    } catch {
      setShot(null);
      setError('That one didn’t save — give it another go.');
      setPhase('posing');
      postStage('posing');
    } finally {
      setUploading(false);
      captureBusy.current = false;
    }
  }

  function beginPose(idx: number) {
    setPoseIdx(idx);
    setShot(null);
    setError(null);
    setPhase('posing');
    postStage('posing');
  }

  function advance() {
    setShot(null);
    if (singlePose || lastPose) onDone();
    else beginPose(poseIdx + 1);
  }

  function retake() {
    setShot(null);
    setPhase('posing');
    postStage('posing');
  }

  return (
    <div className="w-full max-w-sm">
      {/* Pose banner */}
      <div className="text-center">
        <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-[0.3em] text-[var(--color-gold-soft)]">
          {singlePose ? 'Retake' : `Pose ${poseIdx + 1} of ${POSES.length}`}
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl leading-tight">{pose.title}</h2>
        <p className="mt-2 text-sm text-[var(--color-blush)]">{pose.hint}</p>
      </div>

      {/* Viewfinder */}
      <div className="relative mt-5 aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-lg)] bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-cover transition-opacity duration-500 ${phase === 'captured' ? 'opacity-0' : 'opacity-100'}`}
          style={{ transform: 'scaleX(-1)' }} // mirror the preview only
        />

        {/* Captured preview (the real, unmirrored photo) */}
        {phase === 'captured' && shot && (
          <img src={shot.dataUrl} alt="Your captured pose" className="absolute inset-0 h-full w-full object-cover" />
        )}

        {/* Face guide frame */}
        {(phase === 'posing' || phase === 'countdown') && (
          <svg viewBox="0 0 100 133" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-70">
            <rect x="14" y="14" width="72" height="105" rx="14" fill="none" stroke="var(--color-gold-soft)" strokeWidth="0.7" strokeDasharray="10 7" />
          </svg>
        )}

        {/* Starting spinner */}
        {phase === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-gold-soft)]/30 border-t-[var(--color-gold)]" />
            <p className="text-sm text-[var(--color-blush)]">Waking up your camera…</p>
          </div>
        )}

        {/* 3-2-1 countdown */}
        <AnimatePresence>
          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/25"
            >
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={count}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="font-[family-name:var(--font-display)] text-9xl text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]"
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* White capture flash */}
        <AnimatePresence>
          {flash && (
            <motion.div
              key="flash"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 bg-white"
            />
          )}
        </AnimatePresence>

        {/* Saving badge on the captured preview */}
        {phase === 'captured' && uploading && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-xs text-white">
            Saving…
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-center text-sm text-[var(--color-blush)]">{error}</p>}

      {/* Controls */}
      {phase === 'posing' && (
        <div className="mt-5">
          <button
            onClick={startCountdown}
            disabled={!ready}
            className="w-full rounded-[var(--radius-md)] bg-[var(--color-gold)] px-6 py-4 text-lg font-medium text-[var(--color-ink)] transition enabled:hover:opacity-90 disabled:opacity-50"
          >
            Ready — count me in
          </button>
          {canSkip && (
            <button onClick={advance} className="mt-3 w-full text-sm text-[var(--color-stone-soft)] underline underline-offset-4">
              Skip this pose
            </button>
          )}
        </div>
      )}

      {phase === 'captured' && (
        <div className="mt-5 flex gap-3">
          {canRetake && (
            <button
              onClick={retake}
              disabled={uploading}
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-gold)] px-4 py-4 text-base font-medium text-[var(--color-gold-bright)] transition disabled:opacity-50"
            >
              Retake
            </button>
          )}
          <button
            onClick={advance}
            disabled={uploading}
            className="flex-1 rounded-[var(--radius-md)] bg-[var(--color-gold)] px-4 py-4 text-base font-medium text-[var(--color-ink)] transition enabled:hover:opacity-90 disabled:opacity-50"
          >
            {singlePose ? 'Done →' : lastPose ? 'Finish →' : 'Next pose →'}
          </button>
        </div>
      )}
    </div>
  );
}
