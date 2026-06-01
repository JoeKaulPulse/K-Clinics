'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type Stage = 'intro' | 'auth' | 'consent' | 'capture' | 'analysing' | 'results';
type Finding = { area: string; label: string; note: string; severity: 'mild' | 'moderate' | 'notable' };
type PlanItem = { slug: string; title: string; fromPence: number; reason: string; href: string };
type Photo = { id: string; area: string; dataUrl: string };

const AREAS = [
  { id: 'skin', label: 'Face & skin', hint: 'A clear, front-on photo in soft, even light — no makeup if possible.' },
  { id: 'teeth', label: 'Teeth & smile', hint: 'A relaxed, natural smile showing your front teeth.' },
  { id: 'hair', label: 'Hair & scalp', hint: 'Your hairline or the area you’d like assessed.' },
  { id: 'body', label: 'Body & contour', hint: 'A clothed photo of the area (no intimate areas).' },
];

const money = (p: number) => (p > 0 ? `£${(p / 100).toLocaleString('en-GB')}` : 'On consultation');
const sevColor = (s: string) => (s === 'notable' ? '#d98c8c' : s === 'moderate' ? '#d8b26a' : '#8fae8f');

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

const gold = 'var(--color-gold,#c8a96a)';

export function KVision({ signedIn, firstName, enabled }: { signedIn: boolean; firstName: string; enabled: boolean }) {
  const [stage, setStage] = useState<Stage>('intro');
  const [authed, setAuthed] = useState(signedIn);
  const [name, setName] = useState(firstName);
  const [areas, setAreas] = useState<Set<string>>(new Set(['skin']));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [consent, setConsent] = useState(false);
  const [storeImages, setStoreImages] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ summary: string; findings: Finding[]; plan: PlanItem[]; confidence: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function begin() { setError(''); setStage(authed ? 'consent' : 'auth'); }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const next: Photo[] = [];
    for (const f of Array.from(files).slice(0, 4 - photos.length)) {
      try { next.push({ id: crypto.randomUUID(), area: [...areas][0] || 'skin', dataUrl: await downscale(f) }); } catch { /* skip */ }
    }
    setPhotos((p) => [...p, ...next].slice(0, 4));
  }

  async function analyse() {
    if (!consent) { setError('Please give your consent to continue.'); return; }
    if (photos.length === 0) { setError('Add at least one photo.'); return; }
    setError(''); setStage('analysing');
    try {
      const res = await fetch('/api/ai-consultation/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areas: [...areas], images: photos.map((p) => ({ area: p.area, dataUrl: p.dataUrl })), storeImages, consent: true }),
      });
      const j = await res.json();
      if (j.ok) { setResult(j); await new Promise((r) => setTimeout(r, 900)); setStage('results'); }
      else { setError(j.message || 'Something went wrong.'); setStage('capture'); }
    } catch { setError('Network error. Please try again.'); setStage('capture'); }
  }

  return (
    <section className="relative min-h-[88vh] overflow-hidden bg-[#0c0b0a] text-[#f4ece1]">
      {/* ambient gradient + grid */}
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(200,169,106,0.18), transparent 70%), radial-gradient(40% 40% at 80% 90%, rgba(200,169,106,0.10), transparent 70%)' }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <div className="container-lux relative z-10 py-20 md:py-28">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-3xl text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-[var(--color-gold,#c8a96a)]">K Vision · AI Consultation</p>
              <h1 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(2.4rem,1.5rem+4vw,4.5rem)] leading-[1.05]">See yourself in a new light.</h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-[#cdbfae]">Upload a photo and our AI analyses your skin, smile and hair — then builds a personalised, bookable treatment plan in seconds.</p>
              {enabled ? (
                <button onClick={begin} className="group mt-10 inline-flex items-center gap-3 rounded-full bg-[var(--color-gold,#c8a96a)] px-8 py-4 text-base font-medium text-[#0c0b0a] transition-transform hover:scale-[1.03]">
                  Begin your analysis
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </button>
              ) : (
                <p className="mt-10 text-sm text-[#cdbfae]">Coming soon.</p>
              )}
              <p className="mt-6 text-xs text-[#9a8f80]">Personalised cosmetic guidance — not a medical diagnosis. Free with a K Clinics account.</p>
            </motion.div>
          )}

          {stage === 'auth' && (
            <AuthStep key="auth" onDone={(n) => { setAuthed(true); if (n) setName(n); setStage('consent'); }} onError={setError} />
          )}

          {stage === 'consent' && (
            <motion.div key="consent" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-2xl">
              <Heading kicker="Before we begin" title={`A quick word${name ? `, ${name}` : ''}.`} />
              <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-[#cdbfae] backdrop-blur">
                <p>K Vision gives <strong className="text-[#f4ece1]">personalised cosmetic guidance</strong> from your photos — it is not a medical diagnosis. Anything we suggest is confirmed by a clinician at your in-clinic consultation and patch test.</p>
                <p>Please upload clear photos of your <strong className="text-[#f4ece1]">face, skin, teeth, hair or body</strong> — never intimate areas. Your photos are sensitive data and are <strong className="text-[#f4ece1]">encrypted</strong>.</p>
                <label className="flex items-start gap-3 pt-1"><input type="checkbox" checked={storeImages} onChange={(e) => setStoreImages(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold,#c8a96a)]" /> Save my photos to my record so my clinician can see them (recommended). Untick to analyse and discard.</label>
                <label className="flex items-start gap-3"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-gold,#c8a96a)]" /> I consent to K Clinics processing my photos for this analysis, and I understand this is cosmetic guidance, not a diagnosis. *</label>
              </div>
              <NavRow onBack={() => setStage('intro')} next={{ label: 'Continue', onClick: () => consent ? setStage('capture') : setError('Please tick the consent box.') }} />
            </motion.div>
          )}

          {stage === 'capture' && (
            <motion.div key="capture" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-2xl">
              <Heading kicker="Step 1" title="What would you like us to look at?" />
              <div className="mt-5 flex flex-wrap gap-2">
                {AREAS.map((a) => {
                  const on = areas.has(a.id);
                  return <button key={a.id} onClick={() => setAreas((p) => { const n = new Set(p); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n.size ? n : p; })}
                    className={`rounded-full border px-4 py-2 text-sm transition-all ${on ? 'border-[var(--color-gold,#c8a96a)] bg-[var(--color-gold,#c8a96a)] text-[#0c0b0a]' : 'border-white/15 text-[#cdbfae] hover:border-white/40'}`}>{a.label}</button>;
                })}
              </div>
              <p className="mt-3 text-sm text-[#9a8f80]">{AREAS.find((a) => areas.has(a.id))?.hint}</p>

              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {photos.map((p) => (
                  <div key={p.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10">
                    <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => setPhotos((arr) => arr.filter((x) => x.id !== p.id))} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs opacity-0 transition-opacity group-hover:opacity-100">✕</button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-2xl border border-dashed border-white/20 text-[#cdbfae] transition-colors hover:border-[var(--color-gold,#c8a96a)] hover:text-[var(--color-gold,#c8a96a)]">
                    <span className="text-center text-sm"><span className="block text-2xl">＋</span>Add photo</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />

              <NavRow onBack={() => setStage('consent')} next={{ label: 'Analyse my photos', onClick: analyse, disabled: photos.length === 0 }} />
            </motion.div>
          )}

          {stage === 'analysing' && (
            <motion.div key="analysing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-md text-center">
              <div className="relative mx-auto aspect-square w-72 overflow-hidden rounded-3xl border border-white/10">
                {photos[0] && <img src={photos[0].dataUrl} alt="" className="h-full w-full object-cover opacity-90" />}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent, rgba(12,11,10,0.5))' }} />
                {/* scan line */}
                <motion.div className="absolute inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, boxShadow: `0 0 18px ${gold}` }}
                  initial={{ top: '0%' }} animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
                {/* pulsing markers */}
                {[[30, 35], [62, 44], [46, 62]].map(([x, y], i) => (
                  <motion.span key={i} className="absolute h-3 w-3 rounded-full" style={{ left: `${x}%`, top: `${y}%`, border: `1.5px solid ${gold}` }}
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0.6] }} transition={{ delay: 0.6 + i * 0.5, duration: 1.2, repeat: Infinity, repeatDelay: 1 }} />
                ))}
              </div>
              <p className="mt-7 font-[family-name:var(--font-display)] text-2xl">Analysing…</p>
              <p className="mt-2 text-sm text-[#9a8f80]">Reading tone, texture and structure — building your plan.</p>
            </motion.div>
          )}

          {stage === 'results' && result && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl">
              <div className="flex items-center justify-between gap-4">
                <Heading kicker="Your analysis" title={result.summary} />
                <Ring value={result.confidence} />
              </div>

              {result.findings.length > 0 && (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {result.findings.map((f, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: sevColor(f.severity) }} />
                        <span className="text-sm font-medium">{f.label}</span>
                        <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-[#9a8f80]">{f.area}</span>
                      </div>
                      <p className="mt-2 text-sm text-[#cdbfae]">{f.note}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              <h3 className="mt-12 font-[family-name:var(--font-display)] text-2xl">Your recommended plan</h3>
              <div className="mt-4 space-y-3">
                {result.plan.map((p, i) => (
                  <motion.a key={p.slug + i} href={p.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition-colors hover:border-[var(--color-gold,#c8a96a)]">
                    <div>
                      <p className="font-medium">{p.title}</p>
                      <p className="mt-1 text-sm text-[#cdbfae]">{p.reason}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-[#9a8f80]">from {money(p.fromPence)}</p>
                      <span className="mt-1 inline-block rounded-full bg-[var(--color-gold,#c8a96a)] px-4 py-1.5 text-sm font-medium text-[#0c0b0a]">Book →</span>
                    </div>
                  </motion.a>
                ))}
              </div>

              {result.plan[0] && (
                <a href={result.plan[0].href} className="mt-8 block w-full rounded-full bg-[var(--color-gold,#c8a96a)] py-4 text-center text-base font-medium text-[#0c0b0a] transition-transform hover:scale-[1.01]">
                  Book your plan
                </a>
              )}
              <p className="mt-5 text-center text-xs text-[#9a8f80]">Personalised cosmetic guidance, not a medical diagnosis. Your clinician confirms everything at your consultation and patch test.</p>
              <button onClick={() => { setResult(null); setPhotos([]); setConsent(false); setStage('intro'); }} className="mx-auto mt-4 block text-sm text-[#cdbfae] underline-offset-4 hover:underline">Start a new analysis</button>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="mx-auto mt-6 max-w-2xl rounded-xl border border-[#d98c8c]/30 bg-[#d98c8c]/10 px-4 py-3 text-center text-sm text-[#f4d6d6]">{error}</p>}
      </div>
    </section>
  );
}

function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--color-gold,#c8a96a)]">{kicker}</p>
      <h2 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] leading-tight">{title}</h2>
    </div>
  );
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

function AuthStep({ onDone, onError }: { onDone: (firstName?: string) => void; onError: (e: string) => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [f, setF] = useState({ firstName: '', email: '', password: '', company: '' });
  const [busy, setBusy] = useState(false);
  const input = 'w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[#f4ece1] outline-none placeholder:text-[#9a8f80] focus:border-[var(--color-gold,#c8a96a)]';

  async function go() {
    setBusy(true); onError('');
    const url = mode === 'signup' ? '/api/account/signup' : '/api/account/login';
    const body = mode === 'signup' ? { firstName: f.firstName, email: f.email, password: f.password, locale: 'en', company: f.company } : { email: f.email, password: f.password };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.ok) onDone(mode === 'signup' ? f.firstName : undefined);
      else { onError(j.error || 'Something went wrong.'); setBusy(false); }
    } catch { onError('Network error.'); setBusy(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-md">
      <Heading kicker="Almost there" title={mode === 'signup' ? 'Create your free account' : 'Welcome back'} />
      <p className="mt-3 text-sm text-[#cdbfae]">{mode === 'signup' ? 'Your account keeps your analysis private and unlocks 15% off your first visit.' : 'Sign in to run your analysis.'}</p>
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
