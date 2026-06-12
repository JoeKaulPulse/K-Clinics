'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { SESSION_STEPS, CLIENT_STAGE_COPY, type SessionStepKey } from '@/lib/appointment-session';
import type { ClientLiveView } from '@/lib/appointment-session-server';
import { CheckIcon } from '@/components/ui/session-icons';

// BLD-138 v2 — the client's phone companion. A dark, jewel-box page that
// mirrors the in-clinic session in real time: the current stage breathes at
// the top, the journey unfolds beneath, and the person looking after the
// client is named (with their photo) at every touchpoint. Optional on-device
// notifications + a gentle vibration as the visit moves forward.
const POLL_MS = 4000;

const gold = '#c8a96a';
const STAGE_ORDER = SESSION_STEPS.map((s) => s.key);

export function LiveCompanion({ token, firstName, treatmentTitle, startAt, durationMin, practitionerName, initial }: {
  token: string; firstName: string; treatmentTitle: string; startAt: string; durationMin: number;
  practitionerName: string | null; initial: ClientLiveView | null;
}) {
  const reduce = useReducedMotion();
  const [live, setLive] = useState<ClientLiveView | null>(initial);
  const [notifyOn, setNotifyOn] = useState(false);
  const [canNotify, setCanNotify] = useState(false);
  useEffect(() => { setCanNotify(typeof Notification !== 'undefined'); }, []);
  const lastStage = useRef<string | null>(initial?.stage ?? null);
  const lastRev = useRef(initial?.rev ?? '');

  // Live link: SSE with poll fallback (same resilience as the in-store kiosk).
  useEffect(() => {
    let stopped = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let errors = 0;

    const apply = (v: ClientLiveView | null) => {
      if (stopped || !v || v.rev === lastRev.current) return;
      lastRev.current = v.rev;
      setLive(v);
    };

    const poll = () => {
      if (pollTimer) return;
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch(`/api/booking/live/${encodeURIComponent(token)}`);
          const j = await res.json().catch(() => null);
          if (j?.ok) apply(j.live);
        } catch { /* next tick */ }
      }, POLL_MS);
    };

    es = new EventSource(`/api/booking/live/${encodeURIComponent(token)}/stream`);
    es.onopen = () => { errors = 0; };
    es.onmessage = (e) => { try { apply(JSON.parse(e.data)); } catch { /* ignore */ } };
    es.onerror = () => {
      errors += 1;
      if (errors >= 3 || es?.readyState === EventSource.CLOSED) { es?.close(); es = null; poll(); }
    };

    return () => { stopped = true; es?.close(); if (pollTimer) clearInterval(pollTimer); };
  }, [token]);

  // Stage-change moments: gentle vibration + (opt-in) notification.
  useEffect(() => {
    const stage = live?.stage ?? null;
    if (!stage || stage === lastStage.current) return;
    lastStage.current = stage;
    try { navigator.vibrate?.(40); } catch { /* unsupported */ }
    if (notifyOn && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      const copy = CLIENT_STAGE_COPY[stage as SessionStepKey];
      if (copy) { try { new Notification(`KClinics — ${copy.title}`, { body: copy.note, tag: 'kc-live' }); } catch { /* unsupported */ } }
    }
  }, [live?.stage, notifyOn]);

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission().catch(() => 'denied');
    setNotifyOn(perm === 'granted');
  }

  const stage = (live?.stage && STAGE_ORDER.includes(live.stage as SessionStepKey) ? live.stage : 'arrival') as SessionStepKey;
  const stageIdx = STAGE_ORDER.indexOf(stage);
  const copy = CLIENT_STAGE_COPY[stage];
  const done = live?.status === 'COMPLETED';
  const withStaff = live?.with ?? null;
  const journey = live?.journey ?? [];

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <main className="grain relative min-h-dvh overflow-hidden bg-[#12100e] text-[#f4ece1]">
      {/* Ambient aura behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-15%] h-[55vh] w-[120vw] -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: `radial-gradient(closest-side, ${gold}, transparent 70%)` }} />
        <div className="absolute bottom-[-20%] right-[-30%] h-[45vh] w-[80vw] rounded-full opacity-15 blur-3xl" style={{ background: 'radial-gradient(closest-side, #7b6a5d, transparent 70%)' }} />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-8">
        {/* Brand */}
        <header className="text-center">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-wide">KClinics</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[#9a8f80]">Your visit · live</p>
        </header>

        {/* Current stage — the breathing centrepiece */}
        <section className="mt-10 text-center" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div key={done ? 'done' : stage} {...fade}>
              {!reduce && !done && (
                <motion.span
                  aria-hidden
                  className="mx-auto mb-6 block h-2.5 w-2.5 rounded-full"
                  style={{ background: gold, boxShadow: `0 0 24px ${gold}` }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight">
                {done ? 'Until next time' : copy.title}
              </h1>
              <p className="mx-auto mt-3 max-w-xs leading-relaxed text-[#cdbfae]">
                {done ? `Thank you for visiting us today, ${firstName}. Your aftercare guide is in your account.` : copy.note}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Who you're with — named and pictured at every touchpoint */}
          <AnimatePresence mode="wait">
            {withStaff && !done && (
              <motion.div key={withStaff.name} {...fade} className="mx-auto mt-7 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] py-2 pl-2 pr-5 backdrop-blur">
                <StaffAvatar name={withStaff.name} photo={withStaff.photo} size={40} />
                <span className="text-left">
                  <span className="block text-sm font-medium">{withStaff.name}</span>
                  <span className="block text-xs text-[#9a8f80]">{withStaff.title || 'Looking after you'}</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Stage track */}
        <section className="mt-12" aria-label="Your visit's stages">
          <ol className="space-y-0">
            {SESSION_STEPS.map((s, i) => {
              const state = done || i < stageIdx ? 'done' : i === stageIdx ? 'now' : 'next';
              const visited = journey.filter((j) => j.step === s.key);
              const host = visited[visited.length - 1];
              return (
                <li key={s.key} className="relative flex gap-4 pb-7 last:pb-0">
                  {/* Spine */}
                  {i < SESSION_STEPS.length - 1 && (
                    <span aria-hidden className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px" style={{ background: state === 'done' ? `${gold}66` : 'rgba(255,255,255,0.08)' }} />
                  )}
                  <span aria-hidden className="relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors duration-500"
                    style={state === 'done'
                      ? { borderColor: gold, background: gold, color: '#12100e' }
                      : state === 'now'
                        ? { borderColor: gold, color: gold }
                        : { borderColor: 'rgba(255,255,255,0.15)', color: '#9a8f80' }}>
                    {state === 'done' ? <CheckIcon /> : state === 'now' && !reduce
                      ? <motion.span className="h-2 w-2 rounded-full" style={{ background: gold }} animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                      : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${state === 'now' ? 'font-medium text-[#f4ece1]' : state === 'done' ? 'text-[#cdbfae]' : 'text-[#9a8f80]'}`}>
                      {CLIENT_STAGE_COPY[s.key].title}
                    </p>
                    {host && state !== 'next' && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9a8f80]">
                        <StaffAvatar name={host.name} photo={host.photo} size={16} />
                        with {host.name}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Visit details + notifications */}
        <footer className="mt-auto pt-12">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center backdrop-blur">
            <p className="text-sm">{treatmentTitle}</p>
            <p className="mt-0.5 text-xs text-[#9a8f80]">
              {new Date(startAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · about {durationMin} min
              {practitionerName ? ` · with ${practitionerName}` : ''}
            </p>
          </div>
          {!notifyOn && canNotify && !done && (
            <button type="button" onClick={enableNotifications}
              className="mx-auto mt-4 block min-h-11 rounded-full border border-white/15 px-5 py-2.5 text-xs text-[#cdbfae] transition-colors hover:border-[#c8a96a] hover:text-[#f4ece1]">
              Notify me as my visit moves forward
            </button>
          )}
          {notifyOn && <p className="mt-4 text-center text-xs text-[#9a8f80]" role="status">Notifications on — we’ll nudge you at each stage.</p>}
        </footer>
      </div>
    </main>
  );
}

function StaffAvatar({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-[#c8a96a] font-[family-name:var(--font-display)] text-[#12100e]" style={{ width: size, height: size, fontSize: Math.max(8, size * 0.38) }}>
      {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
    </span>
  );
}

