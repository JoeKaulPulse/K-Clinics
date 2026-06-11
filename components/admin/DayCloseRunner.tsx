'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { DayCloseConfig, ChecklistSection, ExpectedTakings, StockTakeItem } from '@/lib/day-close';

// End-of-day clinic shutdown — a whole-screen, stepped flow in the same style as
// the client questionnaire. Walks one location through cash-up, stock take and
// the full closedown checklist (cleaning, equipment/fire, security, maintenance).

const money = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const poundsToPence = (s: string) => Math.round((parseFloat(s) || 0) * 100);
const penceToPounds = (p: number) => (p / 100).toFixed(2);

type Step = { kind: 'financial' } | { kind: 'stock' } | { kind: 'section'; section: ChecklistSection };
type CheckState = Record<string, Record<string, { checked: boolean; note: string }>>;

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
};
const trans = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

export function DayCloseRunner({
  config,
  expected,
  stock,
  locationId,
  locationName,
  businessDate,
  onClose,
  onDone,
}: {
  config: DayCloseConfig;
  expected: ExpectedTakings;
  stock: StockTakeItem[];
  locationId: string | null;
  locationName: string;
  businessDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const steps = useMemo<Step[]>(() => {
    const s: Step[] = [{ kind: 'financial' }];
    if (config.stockTake && stock.length) s.push({ kind: 'stock' });
    config.sections.forEach((section) => s.push({ kind: 'section', section }));
    return s;
  }, [config, stock.length]);
  const total = steps.length;

  const [i, setI] = useState(-1); // -1 = intro, total = review
  const [dir, setDir] = useState(1);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ variancePence: number; cardVariance: number; cashDrawerVariance: number } | null>(null);

  // ── Financial state ──
  const [countedCard, setCountedCard] = useState('');
  const [floatOpen, setFloatOpen] = useState('');
  const [cashTakings, setCashTakings] = useState('');
  const [cashCounted, setCashCounted] = useState('');
  const [moneyConfirmed, setMoneyConfirmed] = useState(false);

  // ── Stock counts (prefilled with system quantity) ──
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(stock.map((it) => [it.id, String(it.expectedQty)])),
  );

  // ── Checklist state ──
  const [checks, setChecks] = useState<CheckState>(() => {
    const init: CheckState = {};
    config.sections.forEach((sec) => {
      init[sec.id] = {};
      sec.items.forEach((it) => (init[sec.id][it.id] = { checked: false, note: '' }));
    });
    return init;
  });
  const [notes, setNotes] = useState('');

  const current = i >= 0 && i < total ? steps[i] : null;
  const progress = i < 0 ? 0 : Math.min(100, Math.round(((i + 1) / total) * 100));

  const cardVar = poundsToPence(countedCard) - expected.cardPence;
  const cashVar = config.cashHandling ? poundsToPence(cashCounted) - (poundsToPence(floatOpen) + poundsToPence(cashTakings)) : 0;

  function sectionDone(sec: ChecklistSection) {
    return sec.items.every((it) => checks[sec.id]?.[it.id]?.checked);
  }
  function canAdvance(step: Step | null): boolean {
    if (!step) return true;
    if (step.kind === 'financial') return moneyConfirmed && countedCard.trim() !== '';
    if (step.kind === 'stock') return true;
    if (step.kind === 'section') return sectionDone(step.section);
    return true;
  }

  function go(delta: number) {
    setDir(delta);
    setI((p) => Math.max(-1, Math.min(total, p + delta)));
  }
  function toggle(secId: string, itemId: string) {
    setChecks((p) => ({ ...p, [secId]: { ...p[secId], [itemId]: { ...p[secId][itemId], checked: !p[secId][itemId].checked } } }));
  }
  function setNote(secId: string, itemId: string, v: string) {
    setChecks((p) => ({ ...p, [secId]: { ...p[secId], [itemId]: { ...p[secId][itemId], note: v } } }));
  }

  const allItems = config.sections.reduce((n, s) => n + s.items.length, 0);
  const doneItems = config.sections.reduce((n, s) => n + s.items.filter((it) => checks[s.id]?.[it.id]?.checked).length, 0);

  async function submit() {
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/admin/day-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          financial: {
            countedCardPence: poundsToPence(countedCard),
            floatOpenPence: poundsToPence(floatOpen),
            cashCountedPence: poundsToPence(cashCounted),
            cashTakingsPence: poundsToPence(cashTakings),
          },
          stock: stock.map((it) => ({ itemId: it.id, countedQty: parseFloat(counts[it.id]) || 0 })),
          checklist: checks,
          notes,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult({ variancePence: json.variancePence, cardVariance: json.cardVariance, cashDrawerVariance: json.cashDrawerVariance });
        setStatus('done');
        onDone();
      } else {
        setError(json.error || 'Could not save the close-down.');
        setStatus('error');
      }
    } catch {
      setError('Network error — please try again.');
      setStatus('error');
    }
  }

  const dateLabel = new Date(businessDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-porcelain)]">
      <div className="flex min-h-screen flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[var(--color-porcelain)]/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-4">
            <button onClick={onClose} aria-label="Exit close-down" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-sand)]">
              <motion.div className="h-full bg-[var(--color-gold)]" initial={false} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <span className="w-10 text-right text-xs tabular-nums text-[var(--color-stone)]">{i < 0 || i >= total ? '' : `${i + 1}/${total}`}</span>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10">
          {status === 'done' ? (
            <DoneScreen result={result} cashHandling={config.cashHandling} doneItems={doneItems} allItems={allItems} onClose={onClose} />
          ) : (
            <AnimatePresence mode="wait" custom={dir}>
              {i < 0 ? (
                <motion.div key="intro" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
                  <p className="eyebrow mb-3">{locationName} · {dateLabel}</p>
                  <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+2.4vw,3.25rem)] leading-[1.08]">End-of-day close-down</h1>
                  <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--color-stone)]">
                    We&apos;ll reconcile the day&apos;s takings, complete the stock take and walk every closedown check — so you can lock up knowing nothing&apos;s been missed.
                  </p>
                  <div className="mt-8 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] px-4 py-3 text-sm text-[var(--color-stone)]">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[var(--color-gold)]" fill="none"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                    {total} steps · about 5 minutes. Equipment, fire & security checks included.
                  </div>
                  <button onClick={() => go(1)} className="mt-9 rounded-full bg-[var(--color-gold)] px-7 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)]">
                    Begin close-down
                  </button>
                </motion.div>
              ) : current?.kind === 'financial' ? (
                <motion.div key="financial" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
                  <p className="eyebrow mb-3">Reconciliation</p>
                  <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.6vw,2.5rem)] leading-[1.12]">Cash up &amp; reconcile</h2>

                  <div className="mt-7 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-[var(--color-stone)]">Card takings expected (system)</span>
                      <span className="font-[family-name:var(--font-display)] text-2xl">{money(expected.cardPence)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-stone)]">
                      {expected.chargeCount} treatment charge{expected.chargeCount === 1 ? '' : 's'} · {money(expected.chargesPence)}
                      {expected.orderCount > 0 && <> · {expected.orderCount} product order{expected.orderCount === 1 ? '' : 's'} · {money(expected.ordersPence)}</>}
                    </p>
                  </div>

                  <MoneyField label="Card total on the terminal (Z-report)" value={countedCard} onChange={setCountedCard} autoFocus />
                  <VarianceRow label="Card variance" pence={cardVar} />

                  {config.cashHandling && (
                    <div className="mt-6 border-t border-[var(--color-line)] pt-6">
                      <p className="mb-3 text-sm font-medium">Cash drawer</p>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <MoneyField compact label="Opening float" value={floatOpen} onChange={setFloatOpen} />
                        <MoneyField compact label="Cash takings today" value={cashTakings} onChange={setCashTakings} />
                        <MoneyField compact label="Counted in drawer" value={cashCounted} onChange={setCashCounted} />
                      </div>
                      <VarianceRow label="Drawer variance" pence={cashVar} />
                    </div>
                  )}

                  {/* BLD-191: the day's full takings = card + cash, not card alone. */}
                  {(() => {
                    const cardPart = countedCard.trim() ? poundsToPence(countedCard) : expected.cardPence;
                    const cashPart = config.cashHandling ? poundsToPence(cashTakings) : 0;
                    return (
                      <div className="mt-6 flex items-baseline justify-between rounded-[var(--radius-md)] border border-[var(--color-gold)]/40 bg-[var(--color-porcelain)] px-5 py-4">
                        <div>
                          <span className="font-medium">Total takings today</span>
                          <span className="block text-xs text-[var(--color-stone)]">Card {money(cardPart)}{config.cashHandling ? ` + cash ${money(cashPart)}` : ''}</span>
                        </div>
                        <span className="font-[family-name:var(--font-display)] text-3xl tabular-nums">{money(cardPart + cashPart)}</span>
                      </div>
                    );
                  })()}

                  <label className="mt-6 flex items-start gap-2.5 text-sm">
                    <input type="checkbox" checked={moneyConfirmed} onChange={() => setMoneyConfirmed((v) => !v)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-gold)]" />
                    <span>I&apos;ve counted the takings and double-checked these figures against the terminal and drawer.</span>
                  </label>
                </motion.div>
              ) : current?.kind === 'stock' ? (
                <motion.div key="stock" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
                  <p className="eyebrow mb-3">Stock take</p>
                  <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.6vw,2.5rem)] leading-[1.12]">Count the stock</h2>
                  <p className="mt-3 text-[var(--color-stone)]">Confirm or correct each count. Differences are logged as stock-take adjustments.</p>
                  <div className="mt-7 space-y-2">
                    {stock.map((it) => {
                      const counted = parseFloat(counts[it.id]);
                      const diff = Number.isFinite(counted) ? counted - it.expectedQty : 0;
                      return (
                        <div key={it.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{it.name}</p>
                            <p className="text-xs text-[var(--color-stone)]">{it.category || 'Stock'} · system: {it.expectedQty} {it.unit}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {Math.abs(diff) > 1e-9 && (
                              <span className={`text-xs tabular-nums ${diff < 0 ? 'text-[var(--color-blush)]' : 'text-[var(--color-jade)]'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                            )}
                            <input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              value={counts[it.id]}
                              onChange={(e) => setCounts((p) => ({ ...p, [it.id]: e.target.value }))}
                              className="w-20 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--color-gold)]"
                            />
                            <span className="w-10 text-xs text-[var(--color-stone)]">{it.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : current?.kind === 'section' ? (
                <motion.div key={current.section.id} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">Closedown</p>
                    <span className={`text-xs tabular-nums ${sectionDone(current.section) ? 'text-[var(--color-jade)]' : 'text-[var(--color-stone)]'}`}>
                      {current.section.items.filter((it) => checks[current.section.id]?.[it.id]?.checked).length}/{current.section.items.length}
                    </span>
                  </div>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(1.6rem,1.2rem+1.6vw,2.5rem)] leading-[1.12]">{current.section.title}</h2>
                  {current.section.description && <p className="mt-3 text-[var(--color-stone)]">{current.section.description}</p>}
                  <ul className="mt-7 space-y-2.5">
                    {current.section.items.map((it) => {
                      const st = checks[current.section.id]?.[it.id];
                      return (
                        <li key={it.id} className={`rounded-[var(--radius-md)] border p-4 transition-all ${st?.checked ? 'border-[var(--color-gold)] bg-[var(--color-bone)]' : 'border-[var(--color-line)]'}`}>
                          <label className="flex items-start gap-3">
                            <input type="checkbox" checked={st?.checked ?? false} onChange={() => toggle(current.section.id, it.id)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-gold)]" />
                            <span className="text-[1.05rem] leading-snug">{it.label}</span>
                          </label>
                          {it.note && (
                            <input
                              placeholder="Reading / note…"
                              value={st?.note ?? ''}
                              onChange={(e) => setNote(current.section.id, it.id, e.target.value)}
                              className="mt-2.5 ml-8 w-[calc(100%-2rem)] rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]"
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              ) : (
                // Review / submit
                <motion.div key="review" custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={trans}>
                  <p className="eyebrow mb-3">Almost done</p>
                  <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.3rem+2vw,2.75rem)]">Review &amp; close</h2>

                  <div className="mt-6 space-y-2.5">
                    <SummaryRow label="Card variance" pence={cardVar} />
                    {config.cashHandling && <SummaryRow label="Cash drawer variance" pence={cashVar} />}
                    <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-line)] px-4 py-3 text-sm">
                      <span className="text-[var(--color-stone)]">Closedown checklist</span>
                      <span className={doneItems === allItems ? 'text-[var(--color-jade)]' : 'text-[var(--color-blush)]'}>{doneItems}/{allItems} complete</span>
                    </div>
                  </div>

                  {(cardVar !== 0 || cashVar !== 0) && (
                    <p className="mt-5 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">
                      There&apos;s a variance to explain — add a note below before closing.
                    </p>
                  )}

                  <label className="mt-6 block text-sm font-medium">Notes for the manager (optional)</label>
                  <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to flag — variance reasons, faults, incidents…" className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 py-3 outline-none focus:border-[var(--color-gold)]" />

                  {error && <p className="mt-5 rounded-[var(--radius-sm)] bg-[var(--color-blush)]/25 px-4 py-2.5 text-sm text-[var(--color-ink)]">{error}</p>}
                  <button onClick={submit} disabled={status === 'saving'} className="mt-8 rounded-full bg-[var(--color-gold)] px-7 py-3.5 font-medium text-white shadow-[var(--shadow-gold)] hover:bg-[var(--color-ink)] disabled:opacity-60">
                    {status === 'saving' ? 'Closing…' : 'Complete close-down'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Nav */}
        {status !== 'done' && (
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pb-10">
            <button onClick={() => go(-1)} className={`text-sm font-medium text-[var(--color-stone)] transition-opacity ${i < 0 ? 'pointer-events-none opacity-0' : 'hover:text-[var(--color-ink)]'}`}>Back</button>
            {i >= 0 && i < total && (
              <button onClick={() => canAdvance(current) && go(1)} disabled={!canAdvance(current)} className="rounded-full bg-[var(--color-ink)] px-6 py-2.5 text-sm font-medium text-[var(--color-porcelain)] transition-opacity disabled:opacity-40">
                Continue →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyField({ label, value, onChange, autoFocus, compact }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; compact?: boolean }) {
  return (
    <label className={`block ${compact ? '' : 'mt-6'}`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5 flex items-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 focus-within:border-[var(--color-gold)]">
        <span className="text-[var(--color-stone)]">£</span>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent px-2 py-3 text-lg outline-none"
        />
      </div>
    </label>
  );
}

function VarianceRow({ label, pence }: { label: string; pence: number }) {
  const ok = pence === 0;
  return (
    <div className="mt-2 flex items-center justify-between text-sm">
      <span className="text-[var(--color-stone)]">{label}</span>
      <span className={ok ? 'text-[var(--color-jade)]' : 'font-medium text-[var(--color-blush)]'}>
        {ok ? 'Balanced ✓' : `${pence > 0 ? '+' : '−'}£${(Math.abs(pence) / 100).toFixed(2)}`}
      </span>
    </div>
  );
}

function SummaryRow({ label, pence }: { label: string; pence: number }) {
  const ok = pence === 0;
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-line)] px-4 py-3 text-sm">
      <span className="text-[var(--color-stone)]">{label}</span>
      <span className={ok ? 'text-[var(--color-jade)]' : 'font-medium text-[var(--color-blush)]'}>
        {ok ? 'Balanced ✓' : `${pence > 0 ? '+' : '−'}£${(Math.abs(pence) / 100).toFixed(2)}`}
      </span>
    </div>
  );
}

function DoneScreen({ result, cashHandling, doneItems, allItems, onClose }: { result: { variancePence: number; cardVariance: number; cashDrawerVariance: number } | null; cashHandling: boolean; doneItems: number; allItems: number; onClose: () => void }) {
  const balanced = (result?.variancePence ?? 0) === 0;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
      <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h2 className="font-[family-name:var(--font-display)] text-3xl">The clinic is closed down</h2>
      <p className="mx-auto mt-3 max-w-sm text-[var(--color-stone)]">
        {doneItems}/{allItems} checks complete · {balanced ? 'takings balanced' : 'variance recorded for the manager'}.
        It&apos;s safe to lock up.
      </p>
      <button onClick={onClose} className="mt-7 inline-block rounded-full bg-[var(--color-gold)] px-6 py-3 font-medium text-white hover:bg-[var(--color-ink)]">
        Done
      </button>
    </motion.div>
  );
}
