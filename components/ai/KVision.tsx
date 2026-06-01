'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KMark } from '@/components/brand/marks';

type Stage = 'intro' | 'budget' | 'consent' | 'capture' | 'auth' | 'analysing' | 'results';
type Finding = { area: string; label: string; note: string; severity: 'mild' | 'moderate' | 'notable' };
type PlanTreatment = { slug: string; title: string; sessions: number; intervalWeeks: number; reason: string; fromPence: number; totalPence: number; href: string };
type Phase = { title: string; timing: string; startISO: string; expect: string; treatments: PlanTreatment[]; phaseTotalPence: number };
type Extra = { slug: string; title: string; fromPence: number; reason: string; href: string };
type Result = { summary: string; findings: Finding[]; phases: Phase[]; planTotalPence: number; extras: Extra[]; confidence: number };
type Photo = { id: string; area: string; dataUrl: string };
type Budget = { label: string; pence: number | null };

const AREAS = [
  { id: 'skin', label: 'Face & skin', hint: 'A clear, front-on photo in soft, even light — no makeup if possible.' },
  { id: 'teeth', label: 'Teeth & smile', hint: 'A relaxed, natural smile showing your front teeth.' },
  { id: 'hair', label: 'Hair & scalp', hint: 'Your hairline or the area you’d like assessed.' },
  { id: 'body', label: 'Body & contour', hint: 'A clothed photo of the area (no intimate areas).' },
];
const BUDGETS: Budget[] = [
  { label: 'Up to £250', pence: 25000 },
  { label: '£250–£750', pence: 75000 },
  { label: '£750–£2,000', pence: 200000 },
  { label: '£2,000+', pence: null },
  { label: 'Flexible', pence: null },
];

const gold = 'var(--color-gold,#c8a96a)';
const money = (p: number) => (p > 0 ? `£${(p / 100).toLocaleString('en-GB')}` : 'On consultation');
const sevColor = (s: string) => (s === 'notable' ? '#d98c8c' : s === 'moderate' ? '#d8b26a' : '#8fae8f');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function downscale(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = 768; const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export function KVision({ signedIn, firstName, enabled }: { signedIn: boolean; firstName: string; enabled: boolean }) {
  const [stage, setStage] = useState<Stage>('intro');
  const [authed, setAuthed] = useState(signedIn);
  const [name, setName] = useState(firstName);
  const [areas, setAreas] = useState<Set<string>>(new Set(['skin']));
  const [budget, setBudget] = useState<Budget | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [consent, setConsent] = useState(false);
  const [storeImages, setStoreImages] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhoto = (dataUrl: string) => setPhotos((p) => [...p, { id: crypto.randomUUID(), area: [...areas][0] || 'skin', dataUrl }].slice(0, 4));
  function begin() { setError(''); setStage('budget'); }
  function requestAnalyse() {
    if (!consent) { setError('Please give your consent to continue.'); return; }
    if (photos.length === 0) { setError('Add at least one photo.'); return; }
    setError('');
    if (!authed) { setStage('auth'); return; }
    analyse();
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const next: Photo[] = [];
    for (const f of Array.from(files).slice(0, 4 - photos.length)) {
      try { next.push({ id: crypto.randomUUID(), area: [...areas][0] || 'skin', dataUrl: await downscale(f) }); } catch { /* skip */ }
    }
    setPhotos((p) => [...p, ...next].slice(0, 4));
    if (fileRef.current) fileRef.current.value = '';
  }

  async function analyse() {
    if (!consent || photos.length === 0) return;
    setError(''); setStage('analysing');
    try {
      const res = await fetch('/api/ai-consultation/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areas: [...areas], images: photos.map((p) => ({ area: p.area, dataUrl: p.dataUrl })), budgetPence: budget?.pence ?? null, budgetLabel: budget?.label ?? 'Flexible', storeImages, consent: true }),
      });
      const j = await res.json();
      if (j.ok) { setResult(j); await new Promise((r) => setTimeout(r, 900)); setStage('results'); }
      else { setError(j.message || 'Something went wrong.'); setStage('capture'); }
    } catch { setError('Network error. Please try again.'); setStage('capture'); }
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#0c0b0a] text-[#f4ece1]">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(200,169,106,0.16), transparent 70%), radial-gradient(40% 40% at 80% 95%, rgba(200,169,106,0.10), transparent 70%)' }} />
      {/* Large, low-opacity animated K monogram watermark (brand) */}
      <motion.div aria-hidden className="pointer-events-none absolute -right-[8%] top-1/2 -translate-y-1/2 text-[var(--color-gold,#c8a96a)]"
        initial={{ opacity: 0 }} animate={{ opacity: 0.07 }} transition={{ duration: 1.6 }}>
        <div className="h-[80vh] w-[60vw] max-w-[760px]"><KMark animated /></div>
      </motion.div>

      <div className="container-lux relative z-10 flex min-h-screen flex-col justify-center py-20">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.div key="intro" {...fade} className="mx-auto max-w-3xl text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-[var(--color-gold,#c8a96a)]">AI Consultation</p>
              <h1 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(2.4rem,1.5rem+4vw,4.5rem)] leading-[1.05]">Get your personalised treatment plan.</h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-[#cdbfae]">Upload a photo and our AI analyses your skin, smile and hair — then builds a phased, dated plan to your budget that you can book in a tap.</p>
              {enabled
                ? <button onClick={begin} className="group mt-10 inline-flex items-center gap-3 rounded-full bg-[var(--color-gold,#c8a96a)] px-8 py-4 text-base font-medium text-[#0c0b0a] transition-transform hover:scale-[1.03]">Get my plan <span className="transition-transform group-hover:translate-x-1">→</span></button>
                : <p className="mt-10 text-sm text-[#cdbfae]">Coming soon.</p>}
              <p className="mt-6 text-xs text-[#9a8f80]">Personalised cosmetic guidance — not a medical diagnosis. Free with a K Clinics account.</p>
            </motion.div>
          )}

          {stage === 'budget' && (
            <motion.div key="budget" {...fade} className="mx-auto max-w-2xl">
              <Heading kicker="Step 1" title="What’s your budget?" />
              <p className="mt-3 text-sm text-[#cdbfae]">So we only recommend a plan that works for you. You can always add more later — and spread the cost with Clearpay.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {BUDGETS.map((b) => {
                  const on = budget?.label === b.label;
                  return <button key={b.label} onClick={() => setBudget(b)} className={`rounded-2xl border p-4 text-left transition-all ${on ? 'border-[var(--color-gold,#c8a96a)] bg-[var(--color-gold,#c8a96a)]/10' : 'border-white/15 hover:border-white/40'}`}>
                    <span className="text-base font-medium">{b.label}</span>
                  </button>;
                })}
              </div>
              <NavRow onBack={() => setStage('intro')} next={{ label: 'Continue', onClick: () => budget ? setStage('consent') : setError('Please choose a budget.'), disabled: !budget }} />
            </motion.div>
          )}

          {stage === 'consent' && (
            <motion.div key="consent" {...fade} className="mx-auto max-w-2xl">
              <Heading kicker="Before we begin" title={`A quick word${name ? `, ${name}` : ''}.`} />
              <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-[#cdbfae] backdrop-blur">
                <p>This gives <strong className="text-[#f4ece1]">personalised cosmetic guidance</strong> from your photos — not a medical diagnosis. Anything we suggest is confirmed by a clinician at your in-clinic consultation and patch test.</p>
                <p>Please upload clear photos of your <strong className="text-[#f4ece1]">face, skin, teeth, hair or body</strong> — never intimate areas. Your photos are sensitive data and are <strong className="text-[#f4ece1]">encrypted</strong>.</p>
                <label className="flex items-start gap-3 pt-1"><input type="checkbox" checked={storeImages} onChange={(e) => setStoreImages(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold,#c8a96a)]" /> Save my photos to my record so my clinician can see them (recommended).</label>
                <label className="flex items-start gap-3"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold,#c8a96a)]" /> I consent to K Clinics processing my photos for this analysis, and I understand this is cosmetic guidance, not a diagnosis. *</label>
              </div>
              <NavRow onBack={() => setStage('budget')} next={{ label: 'Continue', onClick: () => consent ? setStage('capture') : setError('Please tick the consent box.') }} />
            </motion.div>
          )}

          {stage === 'capture' && (
            <motion.div key="capture" {...fade} className="mx-auto max-w-2xl">
              <Heading kicker="Step 2" title="What would you like us to look at?" />
              <div className="mt-5 flex flex-wrap gap-2">
                {AREAS.map((a) => { const on = areas.has(a.id); return <button key={a.id} onClick={() => setAreas((p) => { const n = new Set(p); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n.size ? n : p; })} className={`rounded-full border px-4 py-2 text-sm transition-all ${on ? 'border-[var(--color-gold,#c8a96a)] bg-[var(--color-gold,#c8a96a)] text-[#0c0b0a]' : 'border-white/15 text-[#cdbfae] hover:border-white/40'}`}>{a.label}</button>; })}
              </div>
              <p className="mt-3 text-sm text-[#9a8f80]">{AREAS.find((a) => areas.has(a.id))?.hint} For the most accurate read, use <span className="text-[#cdbfae]">Take photo</span> and follow the on-screen face guide.</p>
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p) => (
                  <div key={p.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => setPhotos((arr) => arr.filter((x) => x.id !== p.id))} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs opacity-0 transition-opacity group-hover:opacity-100">✕</button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <>
                    <button onClick={() => { setError(''); setCamOpen(true); }} className="grid aspect-square place-items-center rounded-2xl border border-dashed border-white/20 text-[#cdbfae] transition-colors hover:border-[var(--color-gold,#c8a96a)] hover:text-[var(--color-gold,#c8a96a)]"><span className="text-center text-sm"><span className="mb-1 block text-2xl">◎</span>Take photo</span></button>
                    <button onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-2xl border border-dashed border-white/20 text-[#cdbfae] transition-colors hover:border-[var(--color-gold,#c8a96a)] hover:text-[var(--color-gold,#c8a96a)]"><span className="text-center text-sm"><span className="mb-1 block text-2xl">＋</span>Upload</span></button>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
              <NavRow onBack={() => setStage('consent')} next={{ label: 'Build my plan', onClick: requestAnalyse, disabled: photos.length === 0 }} />
            </motion.div>
          )}

          {stage === 'auth' && <AuthStep key="auth" onBack={() => { setError(''); setStage('capture'); }} onDone={(n) => { setAuthed(true); if (n) setName(n); analyse(); }} onError={setError} />}

          {stage === 'analysing' && (
            <motion.div key="analysing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-md text-center">
              <div className="relative mx-auto aspect-square w-72 overflow-hidden rounded-3xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photos[0] && <img src={photos[0].dataUrl} alt="" className="h-full w-full object-cover opacity-90" />}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(12,11,10,0.5))' }} />
                <motion.div className="absolute inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, boxShadow: `0 0 18px ${gold}` }} initial={{ top: '0%' }} animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
                {[[30, 35], [62, 44], [46, 62]].map(([x, y], i) => (
                  <motion.span key={i} className="absolute h-3 w-3 rounded-full" style={{ left: `${x}%`, top: `${y}%`, border: `1.5px solid ${gold}` }} initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0.6] }} transition={{ delay: 0.6 + i * 0.5, duration: 1.2, repeat: Infinity, repeatDelay: 1 }} />
                ))}
              </div>
              <p className="mt-7 font-[family-name:var(--font-display)] text-2xl">Building your plan…</p>
              <p className="mt-2 text-sm text-[#9a8f80]">Reading tone, texture and structure — scheduling your treatments.</p>
            </motion.div>
          )}

          {stage === 'results' && result && <Results key="results" result={result} budget={budget} onRestart={() => { setResult(null); setPhotos([]); setConsent(false); setBudget(null); setStage('intro'); }} />}
        </AnimatePresence>

        {error && <p className="mx-auto mt-6 max-w-2xl rounded-xl border border-[#d98c8c]/30 bg-[#d98c8c]/10 px-4 py-3 text-center text-sm text-[#f4d6d6]">{error}</p>}
      </div>

      {/* Homepage-style scroll cue (intro only) */}
      {stage === 'intro' && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 md:block">
          <span className="flex h-12 w-7 items-start justify-center rounded-full border border-white/25 p-1.5">
            <span className="hero-scroll-dot h-2 w-2 rounded-full bg-[var(--color-gold-soft)]" />
          </span>
        </div>
      )}

      {camOpen && <CameraCapture faceGuide={areas.has('skin') || areas.has('teeth') || areas.has('hair')} onCapture={(d) => { addPhoto(d); setCamOpen(false); }} onClose={() => setCamOpen(false)} onError={(m) => { setError(m); setCamOpen(false); }} />}
    </section>
  );
}

const fade = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };

function Results({ result, budget, onRestart }: { result: Result; budget: Budget | null; onRestart: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <Heading kicker="Your plan" title={result.summary} />
        <Ring value={result.confidence} />
      </div>

      {result.findings.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {result.findings.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: sevColor(f.severity) }} /><span className="text-sm font-medium">{f.label}</span><span className="ml-auto text-[0.65rem] uppercase tracking-wide text-[#9a8f80]">{f.area}</span></div>
              <p className="mt-2 text-sm text-[#cdbfae]">{f.note}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Phased schedule */}
      <h3 className="mt-12 font-[family-name:var(--font-display)] text-2xl">Your treatment schedule</h3>
      <div className="mt-5 space-y-0">
        {result.phases.map((ph, pi) => (
          <motion.div key={pi} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * pi }} className="relative pl-8">
            {/* timeline rail */}
            <span className="absolute left-[7px] top-2 h-3 w-3 rounded-full border-2" style={{ borderColor: gold, background: '#0c0b0a' }} />
            {pi < result.phases.length - 1 && <span className="absolute left-[12px] top-5 bottom-0 w-px bg-white/12" />}
            <div className="pb-7">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-gold,#c8a96a)]">{ph.title}</span>
                <span className="text-sm text-[#cdbfae]">{ph.timing}</span>
                <span className="text-xs text-[#9a8f80]">· from {fmtDate(ph.startISO)}</span>
              </div>
              <div className="mt-3 space-y-2">
                {ph.treatments.map((t, ti) => (
                  <div key={ti} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
                    <div>
                      <p className="font-medium">{t.title} <span className="text-[#9a8f80]">· {t.sessions} session{t.sessions > 1 ? 's' : ''}{t.intervalWeeks ? ` · every ${t.intervalWeeks} wk${t.intervalWeeks > 1 ? 's' : ''}` : ''}</span></p>
                      <p className="mt-1 text-sm text-[#cdbfae]">{t.reason}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-[#9a8f80]">{money(t.totalPence)}</p>
                      <a href={t.href} className="mt-1 inline-block rounded-full bg-[var(--color-gold,#c8a96a)] px-4 py-1.5 text-sm font-medium text-[#0c0b0a]">Book →</a>
                    </div>
                  </div>
                ))}
              </div>
              {ph.expect && <p className="mt-3 text-sm text-[#cdbfae]"><span className="text-[var(--color-gold,#c8a96a)]">✦ What to expect:</span> {ph.expect}</p>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div>
          <p className="text-sm text-[#9a8f80]">Plan total{budget?.pence ? ` · within your ${budget.label} budget` : ''}</p>
          <p className="font-[family-name:var(--font-display)] text-2xl">{money(result.planTotalPence)}</p>
        </div>
        {result.phases[0]?.treatments[0] && <a href={result.phases[0].treatments[0].href} className="rounded-full bg-[var(--color-gold,#c8a96a)] px-7 py-3 text-sm font-medium text-[#0c0b0a] transition-transform hover:scale-[1.03]">Book your first step →</a>}
      </div>
      <p className="mt-3 text-center text-xs text-[#9a8f80]">Spread the cost with Clearpay. Personalised cosmetic guidance, not a medical diagnosis — confirmed at your consultation and patch test.</p>

      {/* Worth considering (above budget) */}
      {result.extras.length > 0 && (
        <div className="mt-12">
          <h3 className="font-[family-name:var(--font-display)] text-xl">Worth considering</h3>
          <p className="mt-1 text-sm text-[#9a8f80]">Beyond your budget, but our AI felt these could meaningfully help — add them whenever you’re ready.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {result.extras.map((e) => (
              <a key={e.slug} href={e.href} className="group flex items-center justify-between gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 transition-colors hover:border-[var(--color-gold,#c8a96a)]">
                <div><p className="font-medium">{e.title}</p><p className="mt-1 text-sm text-[#cdbfae]">{e.reason}</p></div>
                <div className="shrink-0 text-right"><p className="text-sm text-[#9a8f80]">from {money(e.fromPence)}</p><span className="mt-1 inline-block text-sm text-[var(--color-gold,#c8a96a)] group-hover:underline">Add →</span></div>
              </a>
            ))}
          </div>
        </div>
      )}

      <button onClick={onRestart} className="mx-auto mt-10 block text-sm text-[#cdbfae] underline-offset-4 hover:underline">Start a new plan</button>
    </motion.div>
  );
}

function Heading({ kicker, title }: { kicker: string; title: string }) {
  return <div><p className="text-xs uppercase tracking-[0.3em] text-[var(--color-gold,#c8a96a)]">{kicker}</p><h2 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] leading-tight">{title}</h2></div>;
}

function NavRow({ onBack, next }: { onBack: () => void; next: { label: string; onClick: () => void; disabled?: boolean } }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      <button onClick={onBack} className="text-sm text-[#cdbfae] hover:text-[#f4ece1]">← Back</button>
      <button onClick={next.onClick} disabled={next.disabled} className="rounded-full bg-[var(--color-gold,#c8a96a)] px-6 py-3 text-sm font-medium text-[#0c0b0a] transition-transform hover:scale-[1.03] disabled:opacity-40">{next.label}</button>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
        <motion.circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-gold,#c8a96a)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (c * pct) / 100 }} transition={{ duration: 1, ease: 'easeOut' }} />
      </svg>
      <div className="absolute text-center"><span className="block text-lg font-medium">{pct}</span><span className="block text-[0.55rem] uppercase tracking-wide text-[#9a8f80]">match</span></div>
    </div>
  );
}

function CameraCapture({ faceGuide, onCapture, onClose, onError }: { faceGuide: boolean; onCapture: (dataUrl: string) => void; onClose: () => void; onError: (m: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); setReady(true); }
      } catch { onError('We couldn’t access your camera. Please allow camera access in your browser, or use “Upload” instead.'); }
    })();
    return () => { active = false; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [facing, onError]);
  function snap() {
    const v = videoRef.current; if (!v || !v.videoWidth) return;
    const max = 768; const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, w, h);
    onCapture(canvas.toDataURL('image/jpeg', 0.85));
  }
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95 p-4">
      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl border border-white/10">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
        {faceGuide && <div className="pointer-events-none absolute inset-0 grid place-items-center"><motion.div className="h-[68%] w-[56%] rounded-[50%] border-2" style={{ borderColor: gold, boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2.4, repeat: Infinity }} /></div>}
        <p className="absolute inset-x-0 top-4 px-6 text-center text-sm text-white/85">{faceGuide ? 'Centre your face in the oval, soft even light, hold still' : 'Frame the area clearly and hold still'}</p>
        {!ready && <p className="absolute inset-x-0 bottom-4 text-center text-sm text-white/60">Starting camera…</p>}
      </div>
      <div className="mt-7 flex items-center gap-8">
        <button onClick={onClose} className="text-sm text-white/70 hover:text-white">Cancel</button>
        <button onClick={snap} aria-label="Capture" className="grid h-16 w-16 place-items-center rounded-full border-4 border-white/85 transition-transform active:scale-95"><span className="h-12 w-12 rounded-full bg-white" /></button>
        <button onClick={() => { setReady(false); setFacing((f) => (f === 'user' ? 'environment' : 'user')); }} className="text-sm text-white/70 hover:text-white">Flip</button>
      </div>
    </div>
  );
}

function AuthStep({ onDone, onError, onBack }: { onDone: (firstName?: string) => void; onError: (e: string) => void; onBack: () => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [f, setF] = useState({ firstName: '', email: '', password: '', company: '' });
  const [busy, setBusy] = useState(false);
  const input = 'w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[#f4ece1] outline-none placeholder:text-[#9a8f80] focus:border-[var(--color-gold,#c8a96a)]';
  async function go() {
    setBusy(true); onError('');
    const url = mode === 'signup' ? '/api/account/signup' : '/api/account/login';
    const body = mode === 'signup' ? { firstName: f.firstName, email: f.email, password: f.password, locale: 'en', company: f.company } : { email: f.email, password: f.password };
    try { const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await res.json(); if (j.ok) onDone(mode === 'signup' ? f.firstName : undefined); else { onError(j.error || 'Something went wrong.'); setBusy(false); } } catch { onError('Network error.'); setBusy(false); }
  }
  return (
    <motion.div {...fade} className="mx-auto max-w-md">
      <button onClick={onBack} className="mb-5 text-sm text-[#cdbfae] hover:text-[#f4ece1]">← Back to photos</button>
      <Heading kicker="Your plan is ready" title={mode === 'signup' ? 'Create your free account to reveal it' : 'Welcome back — sign in to reveal it'} />
      <p className="mt-3 text-sm text-[#cdbfae]">{mode === 'signup' ? 'Create a free account to see your personalised plan, keep it private, and unlock 15% off your first visit.' : 'Sign in to reveal your personalised plan.'}</p>
      <div className="mt-6 space-y-3">
        {mode === 'signup' && <input className={input} placeholder="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />}
        <input className={input} type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={input} type="password" placeholder={mode === 'signup' ? 'Password (8+ characters)' : 'Password'} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <input type="text" tabIndex={-1} className="absolute -left-[9999px]" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} aria-hidden />
      </div>
      <div className="mt-6 flex items-center justify-between gap-4">
        <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-sm text-[#cdbfae] hover:text-[#f4ece1]">{mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create one'}</button>
        <button onClick={() => !busy && go()} className="rounded-full bg-[var(--color-gold,#c8a96a)] px-6 py-3 text-sm font-medium text-[#0c0b0a] disabled:opacity-50">{busy ? 'Please wait…' : mode === 'signup' ? 'Create & continue' : 'Sign in'}</button>
      </div>
    </motion.div>
  );
}
