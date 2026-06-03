'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Photo = { id: string; area: string | null; capturedBy: string; createdAt: string };

// Live in-app camera capture for laser before-photos. The image is downscaled
// and uploaded straight to the encrypted store — it is never saved to this
// device. Intimate areas are prohibited and require a clinician attestation.
export function BeforePhotoCapture({ bookingId, clientId, photos, optOutSigned, baseUrl, canManage }: {
  bookingId: string; clientId: string; photos: Photo[]; optOutSigned: boolean; baseUrl: string; canManage: boolean;
}) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [on, setOn] = useState(false);
  const [attest, setAttest] = useState(false);
  const [area, setArea] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [optLink, setOptLink] = useState<string | null>(null);

  useEffect(() => () => stopCam(), []);

  async function startCam() {
    setErr('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      stream.current = s; if (video.current) { video.current.srcObject = s; await video.current.play(); }
      setOn(true);
    } catch { setErr('Could not access the camera. Check permissions.'); }
  }
  function stopCam() { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setOn(false); }

  function capture() {
    const v = video.current; if (!v) return;
    const max = 1280; const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    setShot(c.toDataURL('image/jpeg', 0.85));
    stopCam();
  }

  async function save() {
    if (!shot) return;
    setBusy(true); setErr('');
    const res = await fetch('/api/admin/bookings/before-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, area, dataUrl: shot, attest: true }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) { setShot(null); setArea(''); setAttest(false); router.refresh(); } else setErr(j.error || 'Save failed');
  }
  async function del(id: string) { if (!confirm('Delete this photo?')) return; await fetch(`/api/admin/bookings/before-photo?id=${id}`, { method: 'DELETE' }); router.refresh(); }
  async function genOptOut() {
    const res = await fetch('/api/admin/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'createRequest', clientId, bookingId, templateKey: 'photo_opt_out', kind: 'photo_opt_out' }) });
    const j = await res.json().catch(() => ({}));
    if (j.ok) setOptLink(j.url);
  }

  return (
    <div>
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Before photo <span className="text-xs font-normal text-[var(--color-blush)]">· required for laser</span></h2>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/15 px-3 py-2 text-xs text-[var(--color-ink)]">
          ⚠ Capture stays in this secure system — it is <strong>never saved to this device</strong>. <strong>No intimate areas</strong> may be photographed.
        </div>

        {/* Existing photos */}
        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${baseUrl}/api/admin/bookings/before-photo/${p.id}`} alt={p.area ?? 'before'} className="h-24 w-24 rounded border border-[var(--color-line)] object-cover" />
                {canManage && <button onClick={() => del(p.id)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-white">✕</button>}
                {p.area && <span className="mt-0.5 block max-w-24 truncate text-[0.6rem] text-[var(--color-stone)]">{p.area}</span>}
              </div>
            ))}
          </div>
        )}

        {canManage && photos.length === 0 && !optOutSigned && (
          <div className="mt-3">
            {!shot ? (
              <>
                {on && <video ref={video} playsInline muted className="mb-2 w-full max-w-sm rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-black" />}
                <label className="mb-2 flex items-start gap-2 text-xs text-[var(--color-stone)]">
                  <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5 accent-[var(--color-gold)]" />
                  I confirm this is a <strong>non-intimate</strong> treatment area and the client has consented to the photo.
                </label>
                <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area (e.g. lower legs)" className="mb-2 w-full max-w-xs rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm" />
                <div className="flex flex-wrap gap-2">
                  {!on ? (
                    <button onClick={startCam} disabled={!attest} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Open camera</button>
                  ) : (
                    <button onClick={capture} className="rounded-full bg-[var(--color-gold)] px-4 py-1.5 text-sm text-white">Capture</button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot} alt="preview" className="mb-2 w-full max-w-sm rounded-[var(--radius-sm)] border border-[var(--color-line)]" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Saving…' : 'Save photo'}</button>
                  <button onClick={() => { setShot(null); startCam(); }} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm">Retake</button>
                </div>
              </>
            )}
            {err && <p className="mt-2 text-sm text-[var(--color-blush)]">{err}</p>}

            {/* Opt-out path */}
            <div className="mt-3 border-t border-[var(--color-line)] pt-3 text-xs text-[var(--color-stone)]">
              Client wants to decline the photo?
              {optLink ? (
                <a href={optLink} target="_blank" rel="noopener noreferrer" className="ml-1 text-[var(--color-gold)] hover:underline">Open opt-out form to sign →</a>
              ) : (
                <button onClick={genOptOut} className="ml-1 text-[var(--color-gold)] hover:underline">Generate opt-out form</button>
              )}
            </div>
          </div>
        )}

        {optOutSigned && <p className="mt-3 text-sm text-[var(--color-stone)]">⚠ Client signed a photo opt-out — treatment may proceed without a before photo.</p>}
        {photos.length > 0 && <p className="mt-3 text-sm text-[var(--color-jade)]">✓ Before photo on file.</p>}
      </div>
    </div>
  );
}
