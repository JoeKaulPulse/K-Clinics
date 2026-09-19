'use client';

import { useMemo, useState } from 'react';
import {
  EMPTY_INPUTS, planPricing, tidyPrice, catalogueMarginPct, cataloguePriceForMargin,
  money, pct, type CostLine, type PlannerInputs, type Rounding,
} from '@/lib/pricing-planner';
import { VAT_CLASSES, ratePctForClass, type VatClass } from '@/lib/vat-rates';

export type CatalogueRow = {
  id: string;
  kind: 'variant' | 'product';
  name: string;
  sub: string;
  pricePence: number;
  costPence: number | null;
  vatClass: VatClass;
};
export type StockOption = { id: string; label: string; unit: string; costPence: number };
export type SavedScenario = {
  id: string; name: string; notes: string | null;
  pricePence: number; costPence: number; marginPct: number;
  linkedType: string | null; linkedId: string | null;
  inputs: PlannerInputs; updatedAt: string;
};

// Two `bg-` utilities on one element don't override by class order — the one
// later in the stylesheet wins — so the dark hero card composes from the
// shell rather than adding a second background on top of CARD's.
const CARD_SHELL = 'rounded-[var(--radius-lg)] border p-5';
const CARD = `${CARD_SHELL} border-[var(--color-line)] bg-[var(--color-porcelain)]`;
const CARD_DARK = `${CARD_SHELL} border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]`;
const INPUT = 'mt-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';
const BTN = 'rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50';
const BTN_GHOST = 'rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:border-[var(--color-gold)]';

const poundsOf = (pence: number) => (pence / 100).toFixed(2);
const penceOf = (pounds: string) => Math.round((Number(pounds.replace(/[^0-9.]/g, '')) || 0) * 100);
const num = (v: string) => Number(v.replace(/[^0-9.]/g, '')) || 0;
const newId = () => Math.random().toString(36).slice(2, 10);

export function PricingPlanner({ vat, minMarginPct, catalogue, stock, scenarios, canSave, canApply }: {
  vat: { registered: boolean; defaultRatePct: number };
  minMarginPct: number;
  catalogue: CatalogueRow[];
  stock: StockOption[];
  scenarios: SavedScenario[];
  canSave: boolean;
  canApply: boolean;
}) {
  const [tab, setTab] = useState<'planner' | 'catalogue' | 'saved'>('planner');
  const [inputs, setInputs] = useState<PlannerInputs>({
    ...EMPTY_INPUTS,
    targetMarginPct: minMarginPct > 0 ? minMarginPct : EMPTY_INPUTS.targetMarginPct,
  });
  const [rounding, setRounding] = useState<Rounding>('pound');
  const [link, setLink] = useState<{ type: 'variant' | 'product'; id: string; label: string } | null>(null);

  const set = <K extends keyof PlannerInputs>(key: K, value: PlannerInputs[K]) => setInputs((s) => ({ ...s, [key]: value }));
  const result = useMemo(() => planPricing(inputs, vat), [inputs, vat]);
  const suggested = tidyPrice(result.suggestedPricePence, rounding);
  const atSuggested = useMemo(() => planPricing({ ...inputs, pricePence: suggested }, vat), [inputs, suggested, vat]);

  // ── Cost lines ────────────────────────────────────────────────────────────
  const setLine = (id: string, patch: Partial<CostLine>) =>
    set('costLines', inputs.costLines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = (line?: Partial<CostLine>) =>
    set('costLines', [...inputs.costLines, { id: newId(), label: '', qty: 1, unitCostPence: 0, ...line }]);
  const removeLine = (id: string) => set('costLines', inputs.costLines.filter((l) => l.id !== id));

  // ── Saving ────────────────────────────────────────────────────────────────
  const [saved, setSaved] = useState<SavedScenario[]>(scenarios);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function post(body: Record<string, unknown>) {
    return fetch('/api/admin/finance/pricing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => ({ ok: false, error: 'Network problem — try again.' }));
  }

  async function saveScenario() {
    if (!name.trim()) { setMsg('Give the costing a name first.'); return; }
    setBusy(true); setMsg('');
    const priced = inputs.pricePence > 0 ? result : atSuggested;
    const r = await post({
      op: 'saveScenario', id: editingId, name: name.trim(), notes,
      inputs, linkedType: link?.type ?? null, linkedId: link?.id ?? null,
      pricePence: inputs.pricePence > 0 ? inputs.pricePence : suggested,
      costPence: priced.directCostPence, marginPct: Math.round(priced.marginPct),
    });
    setBusy(false);
    if (!r.ok) { setMsg(r.error || 'Could not save.'); return; }
    const row: SavedScenario = {
      id: r.id, name: name.trim(), notes: notes || null,
      pricePence: inputs.pricePence > 0 ? inputs.pricePence : suggested,
      costPence: priced.directCostPence, marginPct: Math.round(priced.marginPct),
      linkedType: link?.type ?? null, linkedId: link?.id ?? null,
      inputs, updatedAt: new Date().toISOString(),
    };
    setSaved((s) => [row, ...s.filter((x) => x.id !== r.id)]);
    setEditingId(r.id);
    setMsg('Saved ✓');
  }

  async function deleteScenario(id: string) {
    setBusy(true);
    const r = await post({ op: 'deleteScenario', id });
    setBusy(false);
    if (r.ok) {
      setSaved((s) => s.filter((x) => x.id !== id));
      if (editingId === id) setEditingId(null);
    }
  }

  function loadScenario(s: SavedScenario) {
    setInputs({ ...EMPTY_INPUTS, ...s.inputs, costLines: s.inputs.costLines ?? [] });
    setName(s.name); setNotes(s.notes || ''); setEditingId(s.id); setMsg('');
    const row = s.linkedId ? catalogue.find((c) => c.id === s.linkedId) : undefined;
    setLink(row ? { type: row.kind, id: row.id, label: `${row.name} — ${row.sub}` } : null);
    setTab('planner');
  }

  function loadCatalogueRow(row: CatalogueRow) {
    setInputs((s) => ({
      ...s,
      vatClass: row.vatClass,
      pricePence: row.pricePence,
      costLines: row.costPence && row.costPence > 0
        ? [{ id: newId(), label: `${row.name} — recorded cost of goods`, qty: 1, unitCostPence: row.costPence }]
        : s.costLines,
    }));
    setLink({ type: row.kind, id: row.id, label: `${row.name} — ${row.sub}` });
    setName((n) => n || row.name);
    setEditingId(null);
    setMsg('');
    setTab('planner');
  }

  // ── Applying a price back to the catalogue ────────────────────────────────
  const [applyMsg, setApplyMsg] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<CatalogueRow[]>(catalogue);
  async function applyPrice(row: CatalogueRow, pricePence: number, costPence?: number) {
    setApplyMsg((m) => ({ ...m, [row.id]: 'Saving…' }));
    const r = await post({ op: 'applyPrice', kind: row.kind, id: row.id, pricePence, costPence });
    if (r.ok) {
      setRows((s) => s.map((x) => (x.id === row.id ? { ...x, pricePence, costPence: costPence ?? x.costPence } : x)));
      setApplyMsg((m) => ({ ...m, [row.id]: 'Price updated ✓' }));
    } else {
      setApplyMsg((m) => ({ ...m, [row.id]: r.error || 'Could not save.' }));
    }
  }

  const vatRateLabel = vat.registered
    ? `${ratePctForClass(inputs.vatClass, vat.defaultRatePct)}% VAT taken out of the price`
    : 'Not VAT-registered — the whole price is yours';

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {([['planner', 'Planner'], ['catalogue', 'Current prices'], ['saved', `Saved costings (${saved.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm ${tab === id ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'planner' && (
        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── Inputs ─────────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-6">
            <section className={CARD}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-lg">1. What it costs you</h2>
                <span className="text-sm text-[var(--color-stone)]">Cost of goods: <strong>{money(result.goodsPence)}</strong></span>
              </div>
              <p className="mt-1 text-sm text-[var(--color-stone)]">Everything consumed by one sale — product, needles, gloves, the lot. Enter costs <strong>ex VAT</strong>, as your supplier invoices them.</p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
                    <tr><th className="pb-2">Item</th><th className="pb-2 w-24">Qty</th><th className="pb-2 w-32">Unit cost</th><th className="pb-2 w-24 text-right">Line</th><th className="pb-2 w-10" /></tr>
                  </thead>
                  <tbody>
                    {inputs.costLines.map((l) => (
                      <tr key={l.id} className="border-t border-[var(--color-line)]">
                        <td className="py-2 pr-2">
                          <input value={l.label} onChange={(e) => setLine(l.id, { label: e.target.value })} placeholder="e.g. 1ml dermal filler"
                            className={`${INPUT} mt-0 w-full`} />
                        </td>
                        <td className="py-2 pr-2">
                          <input value={String(l.qty)} onChange={(e) => setLine(l.id, { qty: num(e.target.value) })} inputMode="decimal" className={`${INPUT} mt-0 w-20`} />
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[var(--color-stone)]">£</span>
                            <input value={poundsOf(l.unitCostPence)} onChange={(e) => setLine(l.id, { unitCostPence: penceOf(e.target.value) })} inputMode="decimal" className={`${INPUT} mt-0 w-24`} />
                          </div>
                        </td>
                        <td className="py-2 text-right tabular-nums">{money(Math.round(l.qty * l.unitCostPence))}</td>
                        <td className="py-2 text-right">
                          <button onClick={() => removeLine(l.id)} aria-label={`Remove ${l.label || 'line'}`} className="px-2 text-[var(--color-stone)] hover:text-[var(--color-ink)]">×</button>
                        </td>
                      </tr>
                    ))}
                    {inputs.costLines.length === 0 && (
                      <tr className="border-t border-[var(--color-line)]"><td colSpan={5} className="py-4 text-sm text-[var(--color-stone)]">No cost lines yet — add what one sale uses up.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => addLine()} className={BTN_GHOST}>+ Add cost line</button>
                {stock.length > 0 && (
                  <select defaultValue="" onChange={(e) => {
                    const item = stock.find((s) => s.id === e.target.value);
                    if (item) addLine({ label: item.label, qty: 1, unitCostPence: item.costPence });
                    e.currentTarget.value = '';
                  }} className={`${INPUT} mt-0 text-xs`}>
                    <option value="">+ Add from stock…</option>
                    {stock.map((s) => <option key={s.id} value={s.id}>{s.label} — {money(s.costPence)}/{s.unit}</option>)}
                  </select>
                )}
              </div>
            </section>

            <section className={CARD}>
              <h2 className="font-[family-name:var(--font-display)] text-lg">2. Time and overhead</h2>
              <p className="mt-1 text-sm text-[var(--color-stone)]">Chair time and a share of the fixed costs. Leave at zero to price on goods alone.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-[var(--color-stone)]">Appointment time (minutes)
                  <input value={String(inputs.staffMinutes)} onChange={(e) => set('staffMinutes', num(e.target.value))} inputMode="numeric" className={`${INPUT} w-full`} />
                </label>
                <label className="text-xs text-[var(--color-stone)]">Staff cost per hour (£)
                  <input value={poundsOf(inputs.staffHourlyPence)} onChange={(e) => set('staffHourlyPence', penceOf(e.target.value))} inputMode="decimal" className={`${INPUT} w-full`} />
                </label>
                <label className="text-xs text-[var(--color-stone)]">Overhead per sale (£)
                  <input value={poundsOf(inputs.overheadPence)} onChange={(e) => set('overheadPence', penceOf(e.target.value))} inputMode="decimal" className={`${INPUT} w-full`} />
                </label>
              </div>
              <p className="mt-2 text-xs text-[var(--color-stone)]">Staff time adds <strong>{money(result.staffPence)}</strong> to this sale.</p>
            </section>

            <section className={CARD}>
              <h2 className="font-[family-name:var(--font-display)] text-lg">3. What comes off the price</h2>
              <p className="mt-1 text-sm text-[var(--color-stone)]">{vatRateLabel}. Card processing is taken off the gross amount charged.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-[var(--color-stone)]">VAT class
                  <select value={inputs.vatClass} onChange={(e) => set('vatClass', e.target.value as VatClass)} disabled={!vat.registered} className={`${INPUT} w-full disabled:opacity-60`}>
                    {VAT_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-[var(--color-stone)]">Card fee (%)
                  <input value={String(inputs.cardFeePct)} onChange={(e) => set('cardFeePct', num(e.target.value))} inputMode="decimal" className={`${INPUT} w-full`} />
                </label>
                <label className="text-xs text-[var(--color-stone)]">Card fee — fixed (£)
                  <input value={poundsOf(inputs.cardFeeFixedPence)} onChange={(e) => set('cardFeeFixedPence', penceOf(e.target.value))} inputMode="decimal" className={`${INPUT} w-full`} />
                </label>
              </div>
            </section>

            <section className={CARD}>
              <h2 className="font-[family-name:var(--font-display)] text-lg">4. What you want to make</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-[var(--color-stone)]">Target margin (%)
                  <input value={String(inputs.targetMarginPct)} onChange={(e) => set('targetMarginPct', num(e.target.value))} inputMode="decimal" className={`${INPUT} w-full`} />
                </label>
                <label className="text-xs text-[var(--color-stone)]">Round the price to
                  <select value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)} className={`${INPUT} w-full`}>
                    <option value="none">Exact figure</option>
                    <option value="pound">Whole pound</option>
                    <option value="five">Nearest £5 up</option>
                    <option value="ninetynine">£….99</option>
                  </select>
                </label>
                <label className="text-xs text-[var(--color-stone)]">Monthly fixed costs (£)
                  <input value={poundsOf(inputs.monthlyFixedPence)} onChange={(e) => set('monthlyFixedPence', penceOf(e.target.value))} inputMode="decimal" className={`${INPUT} w-full`} />
                </label>
              </div>
              <p className="mt-2 text-xs text-[var(--color-stone)]">
                Margin is measured on what you keep after VAT. {minMarginPct > 0 ? `Your minimum margin target is ${minMarginPct}% (Finance → Financial controls).` : 'No minimum margin is set in Financial controls.'}
              </p>
            </section>
          </div>

          {/* ── Results ────────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section className={CARD_DARK}>
              <p className="text-xs uppercase tracking-wide opacity-70">Charge this</p>
              {result.directCostPence === 0 ? (
                <p className="mt-2 text-sm opacity-80">Add what one sale costs you above and the price lands here.</p>
              ) : result.targetUnreachable ? (
                <p className="mt-2 text-sm">A {inputs.targetMarginPct}% margin can’t be reached while the card fee takes {inputs.cardFeePct}% of every sale. Lower the target or the fee.</p>
              ) : (
                <>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-4xl">{money(suggested)}</p>
                  <p className="mt-2 text-sm opacity-80">For a {inputs.targetMarginPct}% margin on a {money(result.directCostPence)} cost. You keep {money(atSuggested.profitPence)} per sale.</p>
                  <button onClick={() => set('pricePence', suggested)} className="mt-3 rounded-full bg-[var(--color-porcelain)] px-4 py-2 text-sm text-[var(--color-ink)]">Test this price</button>
                </>
              )}
            </section>

            <section className={CARD}>
              <h2 className="font-[family-name:var(--font-display)] text-lg">Try a price</h2>
              <label className="mt-2 block text-xs text-[var(--color-stone)]">Retail price (what the client pays, £)
                <input value={poundsOf(inputs.pricePence)} onChange={(e) => set('pricePence', penceOf(e.target.value))} inputMode="decimal" className={`${INPUT} w-full text-lg`} />
              </label>

              <dl className="mt-4 space-y-1.5 text-sm">
                <Row label="Price charged" value={money(result.pricePence)} />
                {result.vatRatePct > 0 && <Row label={`VAT (${result.vatRatePct}%)`} value={`− ${money(result.vatPence)}`} muted />}
                <Row label="Card fee" value={`− ${money(result.cardFeePence)}`} muted />
                <Row label="Cost of goods" value={`− ${money(result.goodsPence)}`} muted />
                {result.staffPence > 0 && <Row label="Staff time" value={`− ${money(result.staffPence)}`} muted />}
                {result.overheadPence > 0 && <Row label="Overhead" value={`− ${money(result.overheadPence)}`} muted />}
                <div className="border-t border-[var(--color-line)] pt-1.5">
                  <Row label="You keep" value={money(result.profitPence)} strong />
                </div>
                <Row label="Margin" value={result.pricePence > 0 ? pct(result.marginPct) : '—'} />
                <Row label="Mark-up on cost" value={result.pricePence > 0 ? pct(result.markupPct) : '—'} muted />
                {result.breakEvenUnits !== null && <Row label="Sales a month to break even" value={String(result.breakEvenUnits)} muted />}
              </dl>

              {result.belowCost && (
                <p className="mt-3 rounded-[var(--radius-sm)] bg-[#fdecec] px-3 py-2 text-sm text-[#8c2f2f]">This price loses {money(-result.profitPence)} every time you sell it.</p>
              )}
              {!result.belowCost && result.pricePence > 0 && minMarginPct > 0 && result.marginPct < minMarginPct && (
                <p className="mt-3 rounded-[var(--radius-sm)] bg-[#fdf4e3] px-3 py-2 text-sm text-[#7a5a1e]">Below your {minMarginPct}% minimum margin. {money(suggested)} would meet it.</p>
              )}
            </section>

            {canSave && (
              <section className={CARD}>
                <h2 className="font-[family-name:var(--font-display)] text-lg">Save this costing</h2>
                {link && (
                  <p className="mt-1 text-xs text-[var(--color-stone)]">Linked to <strong>{link.label}</strong>{' '}
                    <button onClick={() => setLink(null)} className="underline">unlink</button>
                  </p>
                )}
                <label className="mt-2 block text-xs text-[var(--color-stone)]">Name
                  <input value={name} onChange={(e) => { setName(e.target.value); setMsg(''); }} placeholder="e.g. 1ml filler — 2026 pricing" className={`${INPUT} w-full`} />
                </label>
                <label className="mt-2 block text-xs text-[var(--color-stone)]">Notes
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Assumptions, supplier quote date…" className={`${INPUT} w-full`} />
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={saveScenario} disabled={busy} className={BTN}>{busy ? 'Saving…' : editingId ? 'Update costing' : 'Save costing'}</button>
                  {editingId && <button onClick={() => { setEditingId(null); setName(''); setNotes(''); setMsg(''); }} className={BTN_GHOST}>Save as new instead</button>}
                  {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'catalogue' && (
        <CatalogueTable
          rows={rows} vat={vat} targetMarginPct={inputs.targetMarginPct} minMarginPct={minMarginPct}
          rounding={rounding} canApply={canApply} applyMsg={applyMsg}
          onLoad={loadCatalogueRow} onApply={applyPrice}
        />
      )}

      {tab === 'saved' && (
        <div className={`${CARD} mt-6`}>
          <h2 className="font-[family-name:var(--font-display)] text-lg">Saved costings</h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Open one to see the working behind a price, or to redo it when a supplier cost changes.</p>
          {saved.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--color-stone)]">Nothing saved yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
                  <tr><th className="pb-2">Costing</th><th className="pb-2 text-right">Cost</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Margin</th><th className="pb-2 text-right">Updated</th><th className="pb-2" /></tr>
                </thead>
                <tbody>
                  {saved.map((s) => (
                    <tr key={s.id} className="border-t border-[var(--color-line)]">
                      <td className="py-2 pr-2">
                        <div>{s.name}</div>
                        {s.notes && <div className="text-xs text-[var(--color-stone)]">{s.notes}</div>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{money(s.costPence)}</td>
                      <td className="py-2 text-right tabular-nums">{money(s.pricePence)}</td>
                      <td className="py-2 text-right tabular-nums">{s.marginPct}%</td>
                      <td className="py-2 text-right text-xs text-[var(--color-stone)]">{new Date(s.updatedAt).toLocaleDateString('en-GB')}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button onClick={() => loadScenario(s)} className={BTN_GHOST}>Open</button>
                        {canSave && <button onClick={() => deleteScenario(s.id)} className={`${BTN_GHOST} ml-2`}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? 'text-[var(--color-stone)]' : ''}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold' : ''} ${muted ? 'text-[var(--color-stone)]' : ''}`}>{value}</dd>
    </div>
  );
}

function CatalogueTable({ rows, vat, targetMarginPct, minMarginPct, rounding, canApply, applyMsg, onLoad, onApply }: {
  rows: CatalogueRow[];
  vat: { registered: boolean; defaultRatePct: number };
  targetMarginPct: number;
  minMarginPct: number;
  rounding: Rounding;
  canApply: boolean;
  applyMsg: Record<string, string>;
  onLoad: (row: CatalogueRow) => void;
  onApply: (row: CatalogueRow, pricePence: number) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'variant' | 'product' | 'nocost' | 'thin'>('all');
  const [q, setQ] = useState('');

  const priced = rows.map((r) => {
    const rate = vat.registered ? ratePctForClass(r.vatClass, vat.defaultRatePct) : 0;
    const margin = r.costPence && r.costPence > 0 ? catalogueMarginPct(r.pricePence, r.costPence, rate) : null;
    const target = r.costPence && r.costPence > 0 ? cataloguePriceForMargin(r.costPence, targetMarginPct, rate) : null;
    return { row: r, margin, suggested: target === null ? null : tidyPrice(target, rounding) };
  });
  const shown = priced.filter(({ row, margin }) => {
    if (q && !`${row.name} ${row.sub}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'variant' || filter === 'product') return row.kind === filter;
    if (filter === 'nocost') return !row.costPence;
    if (filter === 'thin') return margin !== null && minMarginPct > 0 && margin < minMarginPct;
    return true;
  });
  const missing = priced.filter((p) => !p.row.costPence).length;

  return (
    <div className={`${CARD} mt-6`}>
      <h2 className="font-[family-name:var(--font-display)] text-lg">What you charge today</h2>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Every service option and retail product, with the margin its listed price earns against the cost of goods recorded on it.
        Staff time, overhead and card fees aren’t recorded per item, so these margins read high — open a row in the planner to cost it properly.
        {missing > 0 && ` ${missing} row${missing === 1 ? ' has' : 's have'} no cost recorded, so no margin can be worked out.`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${INPUT} mt-0`} />
        {([['all', 'All'], ['variant', 'Services'], ['product', 'Products'], ['nocost', 'No cost recorded'], ['thin', 'Below target']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1.5 text-xs ${filter === id ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
            <tr>
              <th className="pb-2">Item</th>
              <th className="pb-2 text-right">Cost</th>
              <th className="pb-2 text-right">Price</th>
              <th className="pb-2 text-right">Margin</th>
              <th className="pb-2 text-right">At {targetMarginPct}%</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map(({ row, margin, suggested }) => {
              const thin = margin !== null && minMarginPct > 0 && margin < minMarginPct;
              return (
                <tr key={row.id} className="border-t border-[var(--color-line)] align-top">
                  <td className="py-2 pr-2">
                    <div>{row.name}</div>
                    <div className="text-xs text-[var(--color-stone)]">{row.sub}</div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{row.costPence ? money(row.costPence) : <span className="text-[var(--color-stone)]">—</span>}</td>
                  <td className="py-2 text-right tabular-nums">{money(row.pricePence)}</td>
                  <td className={`py-2 text-right tabular-nums ${thin ? 'text-[#8c2f2f]' : ''}`}>{margin === null ? '—' : pct(margin)}</td>
                  <td className="py-2 text-right tabular-nums">{suggested === null ? '—' : money(suggested)}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => onLoad(row)} className={BTN_GHOST}>Open in planner</button>
                    {canApply && suggested !== null && suggested > row.pricePence && (
                      <button onClick={() => onApply(row, suggested)} className={`${BTN_GHOST} ml-2`}>Raise to {money(suggested)}</button>
                    )}
                    {applyMsg[row.id] && <div className="mt-1 text-xs text-[var(--color-stone)]">{applyMsg[row.id]}</div>}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr className="border-t border-[var(--color-line)]"><td colSpan={6} className="py-4 text-sm text-[var(--color-stone)]">Nothing matches.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
