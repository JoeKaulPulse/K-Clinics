'use client';

import { useMemo, useState } from 'react';
import { Button, ArrowIcon } from '@/components/ui/Button';
import {
  ROUTE_BY_KEY,
  recommendRoutes,
  primaryRoute,
  COURSE_LEVEL_LABEL,
  type FundingRouteKey,
  type CourseLevelBand,
  type LocationBand,
  type EmploymentBand,
} from '@/lib/funding';

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-[var(--color-ink)] outline-none focus:border-[var(--color-gold)]';
const label = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';

type Opt<T> = { value: T; label: string };

function Seg<T extends string | boolean>({ value, onChange, options }: { value: T | undefined; onChange: (v: T) => void; options: Opt<T>[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`rounded-[var(--radius-sm)] border px-4 py-2 text-sm transition-colors ${active ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-ink)]' : 'border-[var(--color-line)] bg-[var(--color-porcelain)] text-[var(--color-stone)] hover:border-[var(--color-gold)]'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const YES_NO: Opt<boolean>[] = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }];

function StatusBadge({ status }: { status: 'available' | 'coming_soon' }) {
  return status === 'available' ? (
    <span className="rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-[var(--color-gold-soft)]">Available now</span>
  ) : (
    <span className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-[var(--color-stone)]">Register interest</span>
  );
}

export function FundingWizard({ financeApplyUrl }: { financeApplyUrl?: string }) {
  const [phase, setPhase] = useState<'check' | 'results' | 'done'>('check');
  const [a, setA] = useState<{
    age19Plus?: boolean; courseLevel?: CourseLevelBand; location?: LocationBand;
    employment?: EmploymentBand; incomeUnder?: boolean; residencyOk?: boolean; priorLevel3?: boolean;
  }>({});
  const [c, setC] = useState({ name: '', email: '', phone: '', message: '', route: '' as FundingRouteKey | '', company: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const eligible = useMemo<FundingRouteKey[]>(() => {
    if (a.age19Plus === undefined || !a.courseLevel || !a.location || !a.employment) return [];
    return recommendRoutes({
      age19Plus: a.age19Plus,
      residencyOk: a.residencyOk ?? false,
      location: a.location,
      employment: a.employment,
      lowIncome: a.employment === 'unemployed' || (a.incomeUnder ?? false),
      courseLevel: a.courseLevel,
      priorLevel3: a.priorLevel3 ?? false,
    });
  }, [a]);

  function seeOptions() {
    if (a.age19Plus === undefined || !a.courseLevel || !a.location || !a.employment) {
      setError('Please answer the questions above so we can match you to the right options.');
      return;
    }
    setError('');
    setC((p) => ({ ...p, route: primaryRoute(eligible) }));
    setPhase('results');
  }

  async function submit() {
    if (!c.name.trim() || !/\S+@\S+\.\S+/.test(c.email)) { setError('Please enter your name and a valid email.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/academy/funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: c.name, email: c.email, phone: c.phone, message: c.message, company: c.company,
          route: c.route || primaryRoute(eligible),
          eligibleRoutes: eligible,
          courseLevel: a.courseLevel,
          age19Plus: a.age19Plus,
          residencyOk: a.residencyOk,
          lowIncome: a.employment === 'unemployed' || (a.incomeUnder ?? false),
          priorLevel3: a.priorLevel3,
          location: a.location,
          employment: a.employment,
          source: 'academy-funding',
        }),
      });
      const j = await res.json();
      if (j.ok) setPhase('done'); else setError(j.error || 'Could not submit your enquiry.');
    } catch { setError('Network error. Please try again.'); }
    finally { setBusy(false); }
  }

  if (phase === 'done') {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-2xl">Enquiry received</h3>
        <p className="mx-auto mt-3 max-w-md text-[var(--color-stone)]">Thank you — our team will be in touch shortly to talk through your funding options and the next steps. There’s nothing more you need to do right now.</p>
      </div>
    );
  }

  if (phase === 'results') {
    const routes = eligible.map((k) => ROUTE_BY_KEY[k]);
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
        <button type="button" onClick={() => setPhase('check')} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Change my answers</button>
        <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl">Your funding options</h3>
        <p className="mt-1 text-sm text-[var(--color-stone)]">Based on your answers for <strong>{a.courseLevel ? COURSE_LEVEL_LABEL[a.courseLevel] : 'your course'}</strong>. This is a guide — we’ll confirm what you actually qualify for.</p>

        <ul className="mt-5 space-y-3">
          {routes.map((r) => (
            <li key={r.key} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-[family-name:var(--font-display)] text-lg">{r.name}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{r.detail}</p>
              {r.key === 'course_finance' && financeApplyUrl && (
                <a href={financeApplyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium text-[var(--color-gold-deep)] hover:underline">Apply with monthly finance →</a>
              )}
              {r.note && <p className="mt-2 text-xs text-[var(--color-stone)]">{r.note}</p>}
            </li>
          ))}
        </ul>

        <div className="mt-7 border-t border-[var(--color-line)] pt-6">
          <h4 className="font-[family-name:var(--font-display)] text-xl">Apply for funding</h4>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Leave your details and we’ll get the right funding started for you.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="fw-name" className={label}>Full name *</label><input id="fw-name" className={field} value={c.name} onChange={(e) => setC((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><label htmlFor="fw-email" className={label}>Email *</label><input id="fw-email" type="email" className={field} value={c.email} onChange={(e) => setC((p) => ({ ...p, email: e.target.value }))} /></div>
            <div><label htmlFor="fw-phone" className={label}>Phone</label><input id="fw-phone" type="tel" className={field} value={c.phone} onChange={(e) => setC((p) => ({ ...p, phone: e.target.value }))} /></div>
            <div className="sm:col-span-2"><label htmlFor="fw-route" className={label}>Which option are you most interested in?</label>
              <select id="fw-route" className={field} value={c.route} onChange={(e) => setC((p) => ({ ...p, route: e.target.value as FundingRouteKey }))}>
                {eligible.map((k) => <option key={k} value={k}>{ROUTE_BY_KEY[k].name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label htmlFor="fw-message" className={label}>Anything else we should know?</label><textarea id="fw-message" rows={3} className={field} value={c.message} onChange={(e) => setC((p) => ({ ...p, message: e.target.value }))} placeholder="Your goals, which course, any questions…" /></div>
            <input type="text" tabIndex={-1} autoComplete="off" value={c.company} onChange={(e) => setC((p) => ({ ...p, company: e.target.value }))} className="absolute -left-[9999px] h-0 w-0" aria-hidden />
          </div>
          {error && <p role="alert" aria-live="assertive" className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
          <div className="mt-6"><Button onClick={() => !busy && submit()} variant="gold" size="lg">{busy ? 'Submitting…' : 'Submit funding enquiry'} <ArrowIcon /></Button></div>
          <p className="mt-3 text-xs text-[var(--color-stone)]">By submitting you agree we can contact you about funding for your training. Government and council funding depend on eligibility and approval; we’ll confirm what applies to you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6 md:p-8">
      <h3 className="font-[family-name:var(--font-display)] text-2xl">Check your funding options</h3>
      <p className="mt-1 text-sm text-[var(--color-stone)]">Six quick questions. No credit check, no obligation — just a guide to what you could use.</p>
      <div className="mt-6 space-y-5">
        <div><label className={label}>Are you aged 19 or over?</label><Seg value={a.age19Plus} onChange={(v) => setA((p) => ({ ...p, age19Plus: v }))} options={YES_NO} /></div>
        <div><label className={label}>Which level interests you?</label>
          <Seg<CourseLevelBand> value={a.courseLevel} onChange={(v) => setA((p) => ({ ...p, courseLevel: v }))} options={[
            { value: '2', label: COURSE_LEVEL_LABEL['2'] }, { value: '3', label: COURSE_LEVEL_LABEL['3'] }, { value: '4', label: COURSE_LEVEL_LABEL['4'] }, { value: '5_7', label: COURSE_LEVEL_LABEL['5_7'] },
          ]} />
        </div>
        <div><label className={label}>Where do you live?</label>
          <Seg<LocationBand> value={a.location} onChange={(v) => setA((p) => ({ ...p, location: v }))} options={[
            { value: 'islington', label: 'Islington' }, { value: 'london', label: 'Elsewhere in London' }, { value: 'england', label: 'Elsewhere in England' }, { value: 'other', label: 'Outside England' },
          ]} />
        </div>
        <div><label className={label}>Your work situation?</label>
          <Seg<EmploymentBand> value={a.employment} onChange={(v) => setA((p) => ({ ...p, employment: v }))} options={[
            { value: 'employed', label: 'Employed' }, { value: 'self_employed', label: 'Self-employed' }, { value: 'unemployed', label: 'Not working' }, { value: 'other', label: 'Other' },
          ]} />
        </div>
        {a.employment && a.employment !== 'unemployed' && (
          <div><label className={label}>Do you earn under about £25,000 a year?</label><Seg value={a.incomeUnder} onChange={(v) => setA((p) => ({ ...p, incomeUnder: v }))} options={YES_NO} /></div>
        )}
        <div><label className={label}>Have you lived in the UK or EU for the last 3 years (or have settled status)?</label><Seg value={a.residencyOk} onChange={(v) => setA((p) => ({ ...p, residencyOk: v }))} options={YES_NO} /></div>
        <div><label className={label}>Do you already hold a full Level 3 qualification?</label><Seg value={a.priorLevel3} onChange={(v) => setA((p) => ({ ...p, priorLevel3: v }))} options={YES_NO} /></div>
      </div>
      {error && <p role="alert" aria-live="assertive" className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-3 text-sm text-[var(--color-ink)]">{error}</p>}
      <div className="mt-6"><Button onClick={seeOptions} variant="gold" size="lg">See my options <ArrowIcon /></Button></div>
    </div>
  );
}
