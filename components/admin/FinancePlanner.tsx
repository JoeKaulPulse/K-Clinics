'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Plan, PlannerInputs, PlannerMachine, PlannerEnhancement, PricingRow } from '@/lib/finance-planner-types';

// Finance planner UI. Server computes the plan (lib/finance-planner.ts); every
// edit posts a partial inputs object and refreshes, so numbers on screen are
// always the server's. Conventions follow CashflowManager.

const gbp0 = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;
const gbp2 = (v: number) => `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct0 = (v: number) => `${Math.round(v * 100)}%`;
const pct1 = (v: number) => `${(v * 100).toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`;
const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';
const fieldSm = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1 text-right text-xs tabular-nums outline-none focus:border-[var(--color-gold)]';
const btn = 'rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50';
const warnText = 'text-[var(--color-blush-deep)]';

async function post(payload: object): Promise<boolean> {
  const res = await fetch('/api/admin/finance/planner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

const num = (s: string, fallback = 0) => { const n = Number(s); return Number.isFinite(n) ? n : fallback; };

type SectionKey = 'forecast' | 'pricing' | 'machinery' | 'energy' | 'volumes' | 'assumptions';

export function FinancePlanner({ inputs, plan, canManage, uk }: { inputs: PlannerInputs; plan: Plan; canManage: boolean; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [section, setSection] = useState<SectionKey>('forecast');

  const tabs: { key: SectionKey; label: string }[] = [
    { key: 'forecast', label: L('Forecast', 'Прогноз') },
    { key: 'pricing', label: L('Pricing', 'Ціни') },
    { key: 'machinery', label: L('Machinery', 'Обладнання') },
    { key: 'energy', label: L('Energy', 'Енергія') },
    { key: 'volumes', label: L('Volumes', 'Обсяги') },
    { key: 'assumptions', label: L('Assumptions', 'Припущення') },
  ];

  return (
    <div className="space-y-8">
      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-5">
        {[
          { label: L('Year 1 EBITDA', 'EBITDA рік 1'), value: gbp0(plan.summary.y1Ebitda), tone: plan.summary.y1Ebitda < 0 ? warnText : 'text-[var(--color-jade)]' },
          { label: L('Year 3 net profit', 'Чистий прибуток рік 3'), value: gbp0(plan.summary.y3NetProfit), tone: plan.summary.y3NetProfit < 0 ? warnText : 'text-[var(--color-jade)]' },
          { label: L('EBITDA breakeven', 'Беззбитковість EBITDA'), value: plan.summary.breakevenMonth ? `${L('month', 'міс')} ${plan.summary.breakevenMonth}` : '—', tone: '' },
          { label: L('VAT registration hits', 'ПДВ реєстрація'), value: plan.vatCrossingMonth ? `${L('month', 'міс')} ${plan.vatCrossingMonth}` : L('not in horizon', 'поза горизонтом'), tone: '' },
          { label: L('Variants under target margin', 'Позицій нижче цільової маржі'), value: `${plan.summary.underTargetVariants}${plan.summary.belowCostVariants ? ` (${plan.summary.belowCostVariants} ${L('below cost', 'нижче собівартості')})` : ''}`, tone: plan.summary.belowCostVariants ? warnText : '' },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <div className={`font-[family-name:var(--font-display)] text-2xl tabular-nums ${s.tone}`}>{s.value}</div>
            <div className="mt-1 text-xs text-[var(--color-stone)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Section switcher */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setSection(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm ${section === t.key ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] bg-[var(--color-porcelain)] hover:border-[var(--color-gold)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {section === 'forecast' && <Forecast plan={plan} uk={uk} />}
      {section === 'pricing' && <Pricing inputs={inputs} plan={plan} canManage={canManage} uk={uk} />}
      {section === 'machinery' && <Machinery inputs={inputs} canManage={canManage} uk={uk} />}
      {section === 'energy' && <Energy inputs={inputs} plan={plan} canManage={canManage} uk={uk} />}
      {section === 'volumes' && <Volumes inputs={inputs} plan={plan} canManage={canManage} uk={uk} />}
      {section === 'assumptions' && <Assumptions inputs={inputs} plan={plan} canManage={canManage} uk={uk} />}
    </div>
  );
}

function SaveRow({ onSave, msg, uk, extra }: { onSave: () => void; msg: string; uk: boolean; extra?: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button onClick={onSave} className={btn}>{uk ? 'Зберегти' : 'Save'}</button>
      {extra}
      {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
    </div>
  );
}

function useSave() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const save = async (inputs: object, uk: boolean) => {
    const ok = await post({ op: 'save', inputs });
    setMsg(ok ? (uk ? 'Збережено ✓' : 'Saved ✓') : (uk ? 'Помилка' : 'Could not save'));
    if (ok) router.refresh();
  };
  return { msg, save };
}

// ── Forecast ─────────────────────────────────────────────────────────────────

function Forecast({ plan, uk }: { plan: Plan; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Annual summary', 'Річний підсумок')}</h2>
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[720px] text-sm tabular-nums">
            <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <tr>
                {[L('Year', 'Рік'), L('Net revenue', 'Чистий дохід'), L('Gross profit', 'Валовий прибуток'), 'GP %', 'EBITDA', 'EBITDA %', L('D&A', 'Аморт.'), L('Tax', 'Податок'), L('Net profit', 'Чистий прибуток')].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.years.map((y) => (
                <tr key={y.label} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
                  <td className="px-4 py-2.5 font-medium">{y.label}</td>
                  <td className="px-4 py-2.5 text-right">{gbp0(y.netRevenue)}</td>
                  <td className="px-4 py-2.5 text-right">{gbp0(y.grossProfit)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{pct1(y.grossMarginPct)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${y.ebitda < 0 ? warnText : 'text-[var(--color-jade)]'}`}>{gbp0(y.ebitda)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{pct1(y.ebitdaMarginPct)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{gbp0(y.depreciation + y.amortisation)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{gbp0(y.tax)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${y.netProfit < 0 ? warnText : ''}`}>{gbp0(y.netProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-stone)]">
          {L('Annual tax uses the 2026/27 bands (19% to £50k, 26.5% marginal to £250k, then 25%). Monthly rows accrue a flat 19% on profitable months. AIA means cash tax in a machinery-purchase year will be lower than this accrual.',
             'Річний податок за ставками 2026/27 (19% до £50k, 26.5% до £250k, далі 25%). Помісячно нараховується 19% у прибуткові місяці.')}
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Monthly P&L', 'Помісячний P&L')}</h2>
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[980px] text-sm tabular-nums">
            <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <tr>
                {[L('Month', 'Місяць'), L('Sessions', 'Сеанси'), L('Gross revenue', 'Дохід (валовий)'), L('VAT', 'ПДВ'), L('Net revenue', 'Чистий дохід'), L('Direct costs', 'Прямі витрати'), L('Gross profit', 'Валовий прибуток'), L('Overheads', 'Накладні'), 'EBITDA', L('D&A', 'Аморт.'), L('Net profit', 'Чистий прибуток'), ''].map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2.5 text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.months.map((m, i) => {
                const overheads = m.staff + m.rent + m.rates + m.serviceCharge + m.facilityEnergy + m.marketing + m.insurance + m.software + m.cleaning + m.other;
                return (
                  <tr key={i} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
                    <td className="px-3 py-2 font-medium">{m.label}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-stone)]">{Math.round(m.sessions)}</td>
                    <td className="px-3 py-2 text-right">{gbp0(m.grossRevenue)}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-stone)]">{m.outputVat > 0 ? `−${gbp0(m.outputVat)}` : '—'}</td>
                    <td className="px-3 py-2 text-right">{gbp0(m.netRevenue)}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-stone)]">−{gbp0(m.directCosts + m.cardFees)}</td>
                    <td className="px-3 py-2 text-right">{gbp0(m.grossProfit)}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-stone)]">−{gbp0(overheads)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${m.ebitda < 0 ? warnText : 'text-[var(--color-jade)]'}`}>{gbp0(m.ebitda)}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-stone)]">−{gbp0(m.depreciation + m.amortisation)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${m.netProfit < 0 ? warnText : ''}`}>{gbp0(m.netProfit)}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {m.vatOn && <span title={L('VAT-registered from here', 'ПДВ з цього місяця')} className="mr-1 rounded bg-[var(--color-bone)] px-1.5 py-0.5">VAT</span>}
                      {m.overCapacity && <span title={L('Treated hours exceed practitioner capacity — hire or slow the ramp', 'Годин більше, ніж можуть практики')} className={warnText}>⚠</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-stone)]">
          {L('⚠ marks months where treated hours exceed practitioner capacity (headcount + owner). VAT switches on the month after rolling 12-month turnover crosses the threshold.',
             '⚠ — місяці, де годин процедур більше за місткість практиків. ПДВ вмикається після перетину порогу за 12 місяців.')}
        </p>
      </section>
    </div>
  );
}

// ── Pricing ──────────────────────────────────────────────────────────────────

function Pricing({ inputs, plan, canManage, uk }: { inputs: PlannerInputs; plan: Plan; canManage: boolean; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const { msg, save } = useSave();
  const p = inputs.pricing;
  const [levers, setLevers] = useState({
    roundTo: String(p.roundTo), priceForVat: p.priceForVat,
    s3: String(p.courseDiscounts.s3 * 100), s6: String(p.courseDiscounts.s6 * 100), s10: String(p.courseDiscounts.s10 * 100),
  });
  const [targets, setTargets] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(p.targetMarginByClass).map(([k, v]) => [k, String(Math.round(v * 100))])),
  );
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => plan.pricing.filter((r) => showAll || r.sellable), [plan.pricing, showAll]);
  const services = useMemo(() => {
    const by = new Map<string, PricingRow[]>();
    for (const r of rows) {
      const list = by.get(r.service) || [];
      list.push(r);
      by.set(r.service, list);
    }
    return [...by.entries()];
  }, [rows]);

  function saveLevers() {
    save({
      pricing: {
        roundTo: Math.max(1, num(levers.roundTo, 1)), priceForVat: levers.priceForVat,
        courseDiscounts: { s3: num(levers.s3, 10) / 100, s6: num(levers.s6, 15) / 100, s10: num(levers.s10, 20) / 100 },
        targetMarginByClass: Object.fromEntries(Object.entries(targets).map(([k, v]) => [k, Math.min(Math.max(num(v, 70), 0), 95) / 100])),
      },
    }, uk);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Price architecture levers', 'Важелі цінової архітектури')}</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          {L('Recommended price = fully-loaded cost ÷ (1 − target margin − card-fee drag), plus VAT, rounded. Costs include consumables, machine energy, service and depreciation per hour, practitioner time and card fees.',
             'Рекомендована ціна = повна собівартість ÷ (1 − цільова маржа − комісія картки), плюс ПДВ, з округленням.')}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-xs text-[var(--color-stone)]">{L('Round to £', 'Округлення £')}
            <input type="number" value={levers.roundTo} onChange={(e) => setLevers({ ...levers, roundTo: e.target.value })} disabled={!canManage} className={`${field} mt-1 block w-24`} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">{L('Course −% (3 sessions)', 'Курс −% (3)')}
            <input type="number" value={levers.s3} onChange={(e) => setLevers({ ...levers, s3: e.target.value })} disabled={!canManage} className={`${field} mt-1 block w-24`} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">{L('Course −% (6)', 'Курс −% (6)')}
            <input type="number" value={levers.s6} onChange={(e) => setLevers({ ...levers, s6: e.target.value })} disabled={!canManage} className={`${field} mt-1 block w-24`} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">{L('Course −% (10)', 'Курс −% (10)')}
            <input type="number" value={levers.s10} onChange={(e) => setLevers({ ...levers, s10: e.target.value })} disabled={!canManage} className={`${field} mt-1 block w-24`} />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]">
            <input type="checkbox" checked={levers.priceForVat} onChange={(e) => setLevers({ ...levers, priceForVat: e.target.checked })} disabled={!canManage} className="h-4 w-4 accent-[var(--color-gold)]" />
            {L('Price for the VAT-registered state (keeps margin after registration)', 'Ціни для стану з ПДВ')}
          </label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {plan.classes.filter((c) => c.cls !== 'consultation').map((c) => (
            <label key={c.cls} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-xs">
              <span>{c.label}</span>
              <span className="flex items-center gap-1">
                <input type="number" value={targets[c.cls] ?? '70'} onChange={(e) => setTargets({ ...targets, [c.cls]: e.target.value })} disabled={!canManage} className={`${fieldSm} w-14`} aria-label={`${c.label} ${L('target margin %', 'цільова маржа %')}`} />%
              </span>
            </label>
          ))}
        </div>
        {canManage && <SaveRow onSave={saveLevers} msg={msg} uk={uk} />}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Unit economics per treatment', 'Юніт-економіка процедур')}</h2>
          <button onClick={() => setShowAll((s) => !s)} className="text-sm text-[var(--color-gold-deep)] hover:underline">
            {showAll ? L('Sellable only', 'Лише активні') : L('Include hidden/coming soon', 'Показати всі')}
          </button>
        </div>
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[960px] text-sm tabular-nums">
            <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <tr>
                {[L('Variant', 'Варіант'), L('Min', 'Хв'), L('Current £', 'Поточна £'), L('Loaded cost', 'Собівартість'), L('Margin', 'Маржа'), L('Target', 'Ціль'), L('Recommended', 'Рекомендовано'), 'Δ', L('Course 6 rec', 'Курс 6')].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map(([service, list]) => (
                <ServiceRows key={service} service={service} list={list} uk={uk} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-stone)]">
          {L('Red = priced below fully-loaded cost; amber = below the class target margin. Consumables are researched estimates — no recorded COGS exist in the catalogue yet.',
             'Червоний = нижче собівартості; бурштиновий = нижче цільової маржі. Витратні матеріали — оцінки.')}
        </p>
      </section>
    </div>
  );
}

function ServiceRows({ service, list, uk }: { service: string; list: PricingRow[]; uk: boolean }) {
  return (
    <>
      <tr className="border-t border-[var(--color-line)] bg-[var(--color-bone)]/60">
        <td colSpan={9} className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">
          {service} <span className="normal-case">· {list[0].cls}</span>
        </td>
      </tr>
      {list.map((r) => {
        const belowCost = r.contribution < 0;
        const belowTarget = !belowCost && r.contributionPct < r.targetPct;
        return (
          <tr key={`${r.serviceSlug}|${r.variant}`} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
            <td className="max-w-[320px] truncate px-3 py-2" title={r.variant}>
              {r.variant}
              {!r.sellable && <span className="ml-2 rounded bg-[var(--color-bone)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--color-stone)]">{r.status}</span>}
            </td>
            <td className="px-3 py-2 text-right text-[var(--color-stone)]">{r.durationMin}</td>
            <td className="px-3 py-2 text-right">{gbp2(r.price)}</td>
            <td className="px-3 py-2 text-right text-[var(--color-stone)]" title={`${uk ? 'матеріали' : 'consumables'} ${gbp2(r.consumables)} · ${uk ? 'енергія' : 'energy'} ${gbp2(r.machineEnergy)} · ${uk ? 'сервіс' : 'service'} ${gbp2(r.machineService)} · ${uk ? 'амортизація' : 'depreciation'} ${gbp2(r.machineDep)} · ${uk ? 'праця' : 'labour'} ${gbp2(r.labour)} · ${uk ? 'картка' : 'card'} ${gbp2(r.cardFee)}`}>
              {gbp2(r.loadedCost)}
            </td>
            <td className={`px-3 py-2 text-right ${belowCost ? warnText : belowTarget ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-jade)]'}`}>{pct1(r.contributionPct)}</td>
            <td className="px-3 py-2 text-right text-[var(--color-stone)]">{pct0(r.targetPct)}</td>
            <td className="px-3 py-2 text-right font-medium">{gbp0(r.recommended)}</td>
            <td className={`px-3 py-2 text-right ${r.deltaPct > 0.001 ? 'text-[var(--color-jade)]' : r.deltaPct < -0.001 ? warnText : 'text-[var(--color-stone)]'}`}>{r.deltaPct >= 0 ? '+' : ''}{pct0(r.deltaPct)}</td>
            <td className="px-3 py-2 text-right text-[var(--color-stone)]">
              {gbp0(r.course6)}
              {r.currentCourse6 !== null && <span className="ml-1 text-xs">({uk ? 'зараз' : 'now'} {gbp0(r.currentCourse6)})</span>}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ── Machinery ────────────────────────────────────────────────────────────────

function Machinery({ inputs, canManage, uk }: { inputs: PlannerInputs; canManage: boolean; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const { msg, save } = useSave();
  const [machines, setMachines] = useState<PlannerMachine[]>(inputs.machines.map((m) => ({ ...m })));
  const [enh, setEnh] = useState<PlannerEnhancement[]>(inputs.enhancements.map((e) => ({ ...e })));

  const setM = (i: number, patch: Partial<PlannerMachine>) => setMachines(machines.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const setE = (i: number, patch: Partial<PlannerEnhancement>) => setEnh(enh.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">{L('Machines', 'Обладнання')}</h2>
        <p className="mb-3 text-sm text-[var(--color-stone)]">
          {L('Purchase prices are class-typical estimates — replace with your invoice amounts. In-service month: 0 = already owned; 1–36 = bought that month; blank = not owned (excluded from depreciation and the plan).',
             'Ціни — типові оцінки, замініть на фактичні. Місяць введення: 0 = вже є; 1–36 = купівля в цей місяць; порожньо = немає.')}
        </p>
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <tr>
                {[L('Machine', 'Обладнання'), L('Purchase £', 'Ціна £'), L('In-service', 'Введення'), L('Life yrs', 'Роки'), L('£/mo dep', 'Аморт./міс'), 'kWh/hr', L('Service £/yr', 'Сервіс £/рік'), L('Planned hrs/mo', 'Годин/міс')].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machines.map((m, i) => (
                <tr key={m.key} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
                  <td className="max-w-[300px] px-3 py-2">
                    <div className="truncate font-medium" title={m.name}>{m.name}</div>
                    <div className="truncate text-xs text-[var(--color-stone)]" title={`${m.ownership} — ${m.consumablesNote}`}>{m.ownership}</div>
                  </td>
                  <td className="px-3 py-2 text-right"><input type="number" value={m.purchase} onChange={(e) => setM(i, { purchase: num(e.target.value) })} disabled={!canManage} className={`${fieldSm} w-24`} aria-label={`${m.name} ${L('purchase', 'ціна')}`} /></td>
                  <td className="px-3 py-2 text-right"><input type="number" value={m.inServiceMonth ?? ''} placeholder="—" onChange={(e) => setM(i, { inServiceMonth: e.target.value === '' ? null : Math.round(num(e.target.value)) })} disabled={!canManage} className={`${fieldSm} w-16`} aria-label={`${m.name} ${L('in-service month', 'місяць введення')}`} /></td>
                  <td className="px-3 py-2 text-right"><input type="number" value={m.lifeYears} onChange={(e) => setM(i, { lifeYears: num(e.target.value, 5) })} disabled={!canManage} className={`${fieldSm} w-14`} aria-label={`${m.name} ${L('life years', 'роки служби')}`} /></td>
                  <td className="px-3 py-2 text-right text-[var(--color-stone)] tabular-nums">{m.inServiceMonth === null || m.lifeYears <= 0 ? '—' : gbp0(m.purchase / (m.lifeYears * 12))}</td>
                  <td className="px-3 py-2 text-right"><input type="number" step="0.05" value={m.kwhPerTreatmentHour} onChange={(e) => setM(i, { kwhPerTreatmentHour: num(e.target.value) })} disabled={!canManage} className={`${fieldSm} w-16`} aria-label={`${m.name} kWh/hr`} /></td>
                  <td className="px-3 py-2 text-right"><input type="number" value={m.annualService} onChange={(e) => setM(i, { annualService: num(e.target.value) })} disabled={!canManage} className={`${fieldSm} w-20`} aria-label={`${m.name} ${L('annual service', 'сервіс на рік')}`} /></td>
                  <td className="px-3 py-2 text-right"><input type="number" value={m.plannedHoursMonth} onChange={(e) => setM(i, { plannedHoursMonth: num(e.target.value, 1) })} disabled={!canManage} className={`${fieldSm} w-16`} aria-label={`${m.name} ${L('planned hours', 'планові години')}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">{L('Enhancements & fit-out (amortised)', 'Покращення та ремонт (амортизація)')}</h2>
        <p className="mb-3 text-sm text-[var(--color-stone)]">{L('Capitalised clinic improvements, amortised straight-line over their life.', 'Капітальні покращення клініки, амортизуються рівномірно.')}</p>
        <div className="space-y-2">
          {enh.map((e, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2">
              <input value={e.name} onChange={(ev) => setE(i, { name: ev.target.value })} disabled={!canManage} className={`${field} min-w-[240px] flex-1`} aria-label={L('Enhancement name', 'Назва')} />
              <label className="text-xs text-[var(--color-stone)]">£<input type="number" value={e.cost} onChange={(ev) => setE(i, { cost: num(ev.target.value) })} disabled={!canManage} className={`${fieldSm} ml-1 w-24`} aria-label={L('Cost', 'Вартість')} /></label>
              <label className="text-xs text-[var(--color-stone)]">{L('month', 'міс')}<input type="number" value={e.inServiceMonth ?? ''} placeholder="—" onChange={(ev) => setE(i, { inServiceMonth: ev.target.value === '' ? null : Math.round(num(ev.target.value)) })} disabled={!canManage} className={`${fieldSm} ml-1 w-16`} aria-label={L('In-service month', 'Місяць введення')} /></label>
              <label className="text-xs text-[var(--color-stone)]">{L('yrs', 'років')}<input type="number" value={e.lifeYears} onChange={(ev) => setE(i, { lifeYears: num(ev.target.value, 5) })} disabled={!canManage} className={`${fieldSm} ml-1 w-14`} aria-label={L('Life years', 'Роки')} /></label>
              {canManage && <button onClick={() => setEnh(enh.filter((_, j) => j !== i))} aria-label={L('Remove', 'Видалити')} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]">✕</button>}
            </div>
          ))}
          {canManage && (
            <button onClick={() => setEnh([...enh, { name: L('New enhancement', 'Нове покращення'), cost: 0, inServiceMonth: null, lifeYears: 5 }])} className="text-sm text-[var(--color-gold-deep)] hover:underline">
              {L('+ Add enhancement', '+ Додати')}
            </button>
          )}
        </div>
      </section>

      {canManage && <SaveRow onSave={() => save({ machines, enhancements: enh }, uk)} msg={msg} uk={uk} />}
    </div>
  );
}

// ── Energy ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Energy({ inputs, plan, canManage, uk }: { inputs: PlannerInputs; plan: Plan; canManage: boolean; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const { msg, save } = useSave();
  const [e, setE] = useState({
    unitRatePence: String(inputs.energy.unitRatePence), standingPencePerDay: String(inputs.energy.standingPencePerDay),
    baseLoadKWhPerDay: String(inputs.energy.baseLoadKWhPerDay),
  });
  const [curve, setCurve] = useState(inputs.energy.hvacKWhPerRoomMonth.map(String));
  const [hvacRooms, setHvacRooms] = useState(String(inputs.hvacRooms));

  function saveEnergy() {
    save({
      hvacRooms: Math.max(0, Math.round(num(hvacRooms, inputs.hvacRooms))),
      energy: {
        unitRatePence: num(e.unitRatePence, 27), standingPencePerDay: num(e.standingPencePerDay, 55),
        baseLoadKWhPerDay: num(e.baseLoadKWhPerDay, 12), hvacKWhPerRoomMonth: curve.map((v) => Math.max(0, num(v))),
      },
    }, uk);
  }

  const first12 = plan.months.slice(0, 12);
  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Tariff & base load', 'Тариф і базове споживання')}</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-xs text-[var(--color-stone)]">{L('Unit rate (p/kWh)', 'Тариф (p/kWh)')}
            <input type="number" step="0.1" value={e.unitRatePence} onChange={(ev) => setE({ ...e, unitRatePence: ev.target.value })} disabled={!canManage} className={`${field} mt-1 block w-28`} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">{L('Standing charge (p/day)', 'Фікс. плата (p/день)')}
            <input type="number" step="0.1" value={e.standingPencePerDay} onChange={(ev) => setE({ ...e, standingPencePerDay: ev.target.value })} disabled={!canManage} className={`${field} mt-1 block w-28`} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">{L('Base load (kWh/day)', 'База (kWh/день)')}
            <input type="number" step="0.5" value={e.baseLoadKWhPerDay} onChange={(ev) => setE({ ...e, baseLoadKWhPerDay: ev.target.value })} disabled={!canManage} className={`${field} mt-1 block w-28`} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">{L('Rooms heated/cooled', 'Кімнат з кліматом')}
            <input type="number" value={hvacRooms} onChange={(ev) => setHvacRooms(ev.target.value)} disabled={!canManage} className={`${field} mt-1 block w-24`} />
          </label>
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Seasonal heating & cooling (kWh per room per month)', 'Сезонне опалення та охолодження (kWh на кімнату/міс)')}</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          {L('Summer months carry A/C cooling load; winter months carry heat-pump heating. All-electric assumption — no gas meter modelled.',
             'Влітку — кондиціонування, взимку — опалення тепловим насосом. Все на електриці.')}
        </p>
        <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-12">
          {MONTH_NAMES.map((mn, i) => (
            <label key={mn} className="text-center text-xs text-[var(--color-stone)]">{mn}
              <input type="number" value={curve[i]} onChange={(ev) => setCurve(curve.map((c, j) => (j === i ? ev.target.value : c)))} disabled={!canManage} className={`${fieldSm} mt-1`} aria-label={`${mn} kWh`} />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('First-year energy cost', 'Витрати на енергію, рік 1')}</h2>
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[640px] text-sm tabular-nums">
            <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <tr>{[L('Month', 'Місяць'), 'kWh', L('Facility £ (HVAC + base + standing)', 'Приміщення £'), L('Machines £ (in direct costs)', 'Обладнання £')].map((h) => <th key={h} scope="col" className="px-4 py-2.5 text-right first:text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {first12.map((m, i) => (
                <tr key={i} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
                  <td className="px-4 py-2 font-medium">{m.label}</td>
                  <td className="px-4 py-2 text-right text-[var(--color-stone)]">{Math.round(m.totalKWh).toLocaleString('en-GB')}</td>
                  <td className="px-4 py-2 text-right">{gbp0(m.facilityEnergy)}</td>
                  <td className="px-4 py-2 text-right text-[var(--color-stone)]">{gbp0(m.machineEnergyCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canManage && <SaveRow onSave={saveEnergy} msg={msg} uk={uk} />}
    </div>
  );
}

// ── Volumes ──────────────────────────────────────────────────────────────────

function Volumes({ inputs, plan, canManage, uk }: { inputs: PlannerInputs; plan: Plan; canManage: boolean; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const { msg, save } = useSave();
  const [util, setUtil] = useState(inputs.volumes.utilisation.map((u) => String(Math.round(u * 1000) / 10)));
  const [mix, setMix] = useState<Record<string, string>>(
    Object.fromEntries(plan.classes.map((c) => [c.cls, String(c.mixPct)])),
  );
  const [priceOv, setPriceOv] = useState<Record<string, string>>(
    Object.fromEntries(plan.classes.map((c) => [c.cls, inputs.volumes.avgPriceOverride[c.cls] != null ? String(inputs.volumes.avgPriceOverride[c.cls]) : ''])),
  );
  const [durOv, setDurOv] = useState<Record<string, string>>(
    Object.fromEntries(plan.classes.map((c) => [c.cls, inputs.volumes.avgDurationOverride[c.cls] != null ? String(inputs.volumes.avgDurationOverride[c.cls]) : ''])),
  );

  const mixTotal = Object.values(mix).reduce((s, v) => s + num(v), 0);

  function saveVolumes() {
    save({
      volumes: {
        utilisation: util.map((u) => Math.min(Math.max(num(u) / 100, 0), 1)),
        mixByClass: Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, Math.max(0, num(v))])),
        avgPriceOverride: Object.fromEntries(Object.entries(priceOv).map(([k, v]) => [k, v.trim() === '' ? null : num(v)])),
        avgDurationOverride: Object.fromEntries(Object.entries(durOv).map(([k, v]) => [k, v.trim() === '' ? null : num(v)])),
      },
    }, uk);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Room utilisation ramp (% of open room-hours treated)', 'Завантаженість кімнат (%)')}</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">
          {L('The single biggest lever in the model. Current run-rate is roughly 3% (post-reopening); the default ramps to 25% by month 36.',
             'Найважливіший важіль моделі. Поточний рівень ~3%; за замовчуванням зростає до 25% на 36-й місяць.')}
        </p>
        {[0, 1, 2].map((y) => (
          <div key={y} className="mt-3">
            <div className="mb-1 text-xs font-medium text-[var(--color-stone)]">{L('Year', 'Рік')} {y + 1}</div>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {util.slice(y * 12, y * 12 + 12).map((u, i) => (
                <input key={i} type="number" step="0.5" value={u} onChange={(ev) => setUtil(util.map((x, j) => (j === y * 12 + i ? ev.target.value : x)))} disabled={!canManage} className={fieldSm} aria-label={`${L('Month', 'Місяць')} ${y * 12 + i + 1} %`} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Treatment mix (% of treated hours)', 'Мікс процедур (% годин)')}</h2>
          <span className={`text-sm tabular-nums ${Math.abs(mixTotal - 100) > 0.5 ? warnText : 'text-[var(--color-jade)]'}`}>{mixTotal.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <tr>
                {[L('Family', 'Сімейство'), L('Mix %', 'Мікс %'), L('Avg min (live)', 'Хв (кат.)'), L('Min override', 'Хв (своє)'), L('Avg £ (live)', '£ (кат.)'), L('£ override', '£ (своє)'), L('Sellable variants', 'Позицій')].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.classes.map((c) => (
                <tr key={c.cls} className="border-t border-[var(--color-line)]">
                  <td className="px-3 py-2">{c.label}</td>
                  <td className="px-3 py-2 text-right"><input type="number" step="0.5" value={mix[c.cls] ?? '0'} onChange={(ev) => setMix({ ...mix, [c.cls]: ev.target.value })} disabled={!canManage} className={`${fieldSm} w-16`} aria-label={`${c.label} ${L('mix %', 'мікс %')}`} /></td>
                  <td className="px-3 py-2 text-right text-[var(--color-stone)] tabular-nums">{c.avgDurationMin ? Math.round(c.avgDurationMin) : '—'}</td>
                  <td className="px-3 py-2 text-right"><input type="number" value={durOv[c.cls] ?? ''} placeholder="—" onChange={(ev) => setDurOv({ ...durOv, [c.cls]: ev.target.value })} disabled={!canManage} className={`${fieldSm} w-16`} aria-label={`${c.label} ${L('duration override', 'тривалість')}`} /></td>
                  <td className="px-3 py-2 text-right text-[var(--color-stone)] tabular-nums">{c.avgPrice ? gbp0(c.avgPrice) : '—'}</td>
                  <td className="px-3 py-2 text-right"><input type="number" value={priceOv[c.cls] ?? ''} placeholder="—" onChange={(ev) => setPriceOv({ ...priceOv, [c.cls]: ev.target.value })} disabled={!canManage} className={`${fieldSm} w-20`} aria-label={`${c.label} ${L('price override', 'ціна')}`} /></td>
                  <td className="px-3 py-2 text-right text-[var(--color-stone)]">{c.sellableVariants || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-stone)]">
          {L('Live averages are unweighted means over sellable variants of each family; use the override columns to demand-weight them. Mix should sum to 100%.',
             'Середні значення — прості середні по активних позиціях; використовуйте свої значення для точності. Мікс має давати 100%.')}
        </p>
      </section>

      {canManage && <SaveRow onSave={saveVolumes} msg={msg} uk={uk} />}
    </div>
  );
}


function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h3 className="mb-3 font-[family-name:var(--font-display)] text-lg">{title}</h3>
      <div className="flex flex-wrap gap-4">{children}</div>
    </section>
  );
}

function AssumptionField({ label, value, onChange, disabled, w, step, type }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean; w: string; step?: string; type: string;
}) {
  return (
    <label className="text-xs text-[var(--color-stone)]">{label}
      <input type={type} step={step} value={value} onChange={onChange} disabled={disabled} className={`${field} mt-1 block ${w}`} />
    </label>
  );
}

// ── Assumptions ──────────────────────────────────────────────────────────────

function Assumptions({ inputs, plan, canManage, uk }: { inputs: PlannerInputs; plan: Plan; canManage: boolean; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const router = useRouter();
  const { msg, save } = useSave();
  const [a, setA] = useState({
    startMonth: inputs.startMonth, months: String(inputs.months), rooms: String(inputs.rooms),
    openDaysPerWeek: String(inputs.openDaysPerWeek), openHoursPerDay: String(inputs.openHoursPerDay),
    practitionerSalary: String(inputs.staff.practitionerSalary), receptionistSalary: String(inputs.staff.receptionistSalary),
    ownerSalary: String(inputs.staff.ownerSalary), onCost: String(inputs.staff.onCost),
    pr1: String(inputs.staff.practitionersByYear[0] ?? 0), pr2: String(inputs.staff.practitionersByYear[1] ?? 0), pr3: String(inputs.staff.practitionersByYear[2] ?? 0),
    re1: String(inputs.staff.receptionistsByYear[0] ?? 0), re2: String(inputs.staff.receptionistsByYear[1] ?? 0), re3: String(inputs.staff.receptionistsByYear[2] ?? 0),
    productiveHoursPerWeek: String(inputs.staff.productiveHoursPerWeek), workingWeeks: String(inputs.staff.workingWeeks),
    rent: String(inputs.property.rent), rates: String(inputs.property.rates), serviceCharge: String(inputs.property.serviceCharge),
    insurance: String(inputs.overheads.insurance), softwareMonthly: String(inputs.overheads.softwareMonthly),
    cardFeePct: String(inputs.overheads.cardFeePct * 100), cardShare: String(inputs.overheads.cardShare * 100),
    cleaningMonthly: String(inputs.overheads.cleaningMonthly), otherMonthly: String(inputs.overheads.otherMonthly),
    mk1: String((inputs.marketing.pctByYear[0] ?? 0.1) * 100), mk2: String((inputs.marketing.pctByYear[1] ?? 0.1) * 100), mk3: String((inputs.marketing.pctByYear[2] ?? 0.1) * 100),
    floorMonthly: String(inputs.marketing.floorMonthly),
    vatThreshold: String(inputs.tax.vatThreshold), priorTurnover: String(inputs.tax.priorTurnover), vatOverrideMonth: String(inputs.tax.vatOverrideMonth),
  });
  const set = (k: keyof typeof a) => (e: React.ChangeEvent<HTMLInputElement>) => setA({ ...a, [k]: e.target.value });

  function saveAll() {
    save({
      startMonth: /^\d{4}-\d{2}$/.test(a.startMonth) ? a.startMonth : inputs.startMonth,
      months: num(a.months, 36), rooms: num(a.rooms, 9),
      openDaysPerWeek: num(a.openDaysPerWeek, 6), openHoursPerDay: num(a.openHoursPerDay, 9.5),
      staff: {
        practitionerSalary: num(a.practitionerSalary), receptionistSalary: num(a.receptionistSalary),
        ownerSalary: num(a.ownerSalary), onCost: num(a.onCost, 1.16),
        practitionersByYear: [num(a.pr1), num(a.pr2), num(a.pr3)],
        receptionistsByYear: [num(a.re1), num(a.re2), num(a.re3)],
        productiveHoursPerWeek: num(a.productiveHoursPerWeek, 30), workingWeeks: num(a.workingWeeks, 46),
      },
      property: { rent: num(a.rent), rates: num(a.rates), serviceCharge: num(a.serviceCharge) },
      overheads: {
        insurance: num(a.insurance), softwareMonthly: num(a.softwareMonthly),
        cardFeePct: num(a.cardFeePct, 1.7) / 100, cardShare: num(a.cardShare, 95) / 100,
        cleaningMonthly: num(a.cleaningMonthly), otherMonthly: num(a.otherMonthly),
      },
      marketing: { pctByYear: [num(a.mk1, 12) / 100, num(a.mk2, 10) / 100, num(a.mk3, 8) / 100], floorMonthly: num(a.floorMonthly, 1500) },
      tax: { vatThreshold: num(a.vatThreshold, 90000), priorTurnover: num(a.priorTurnover, 25000), vatOverrideMonth: Math.round(num(a.vatOverrideMonth, 0)) },
    }, uk);
  }

  async function resetAll() {
    if (!confirm(L('Reset every planner input to the researched defaults? Your edits will be lost.', 'Скинути всі значення до типових? Ваші зміни буде втрачено.'))) return;
    if (await post({ op: 'reset' })) router.refresh();
  }

  const F = ({ label, k, w = 'w-28', step }: { label: string; k: keyof typeof a; w?: string; step?: string }) => (
    <AssumptionField label={label} type={k === 'startMonth' ? 'month' : 'number'} step={step} value={a[k]} onChange={set(k)} disabled={!canManage} w={w} />
  );

  return (
    <div className="space-y-5">
      <Group title={L('Clinic & capacity', 'Клініка та місткість')}>
        {F({ label: L('Start month', 'Початок'), k: 'startMonth', w: 'w-40' })}
        {F({ label: L('Horizon (months)', 'Горизонт (міс)'), k: 'months', w: 'w-24' })}
        {F({ label: L('Treatment rooms', 'Кімнат'), k: 'rooms', w: 'w-24' })}
        {F({ label: L('Open days/week', 'Днів/тиждень'), k: 'openDaysPerWeek', w: 'w-24' })}
        {F({ label: L('Open hours/day', 'Годин/день'), k: 'openHoursPerDay', w: 'w-24', step: '0.5' })}
      </Group>
      <Group title={L('Staffing', 'Персонал')}>
        {F({ label: L('Practitioner salary £/yr', 'Зарплата практика £/рік'), k: 'practitionerSalary' })}
        {F({ label: L('Receptionist salary £/yr', 'Зарплата рецепції £/рік'), k: 'receptionistSalary' })}
        {F({ label: L('Owner salary £/yr', 'Зарплата власника £/рік'), k: 'ownerSalary' })}
        {F({ label: L('On-cost ×', 'Нарахування ×'), k: 'onCost', w: 'w-20', step: '0.01' })}
        {F({ label: L('Practitioners Y1/Y2/Y3', 'Практики Р1'), k: 'pr1', w: 'w-16' })}
        {F({ label: 'Y2', k: 'pr2', w: 'w-16' })}
        {F({ label: 'Y3', k: 'pr3', w: 'w-16' })}
        {F({ label: L('Reception Y1', 'Рецепція Р1'), k: 're1', w: 'w-16' })}
        {F({ label: 'Y2', k: 're2', w: 'w-16' })}
        {F({ label: 'Y3', k: 're3', w: 'w-16' })}
        {F({ label: L('Productive hrs/week', 'Продуктивних год/тиж'), k: 'productiveHoursPerWeek', w: 'w-24' })}
        {F({ label: L('Working weeks/yr', 'Робочих тижнів'), k: 'workingWeeks', w: 'w-24' })}
        <span className="self-end pb-2 text-xs text-[var(--color-stone)]">{L('Loaded labour', 'Вартість години')}: {gbp2(plan.loadedLabourPerHour)}/h</span>
      </Group>
      <Group title={L('Property & overheads', 'Приміщення та накладні')}>
        {F({ label: L('Rent £/yr', 'Оренда £/рік'), k: 'rent' })}
        {F({ label: L('Business rates £/yr', 'Податок на нерухомість £/рік'), k: 'rates' })}
        {F({ label: L('Service charge £/yr', 'Сервісний збір £/рік'), k: 'serviceCharge' })}
        {F({ label: L('Insurance £/yr', 'Страхування £/рік'), k: 'insurance' })}
        {F({ label: L('Hosting/infra £/mo', 'Хостинг £/міс'), k: 'softwareMonthly', w: 'w-24' })}
        {F({ label: L('Card fee %', 'Комісія картки %'), k: 'cardFeePct', w: 'w-20', step: '0.1' })}
        {F({ label: L('Card share %', 'Частка карток %'), k: 'cardShare', w: 'w-20' })}
        {F({ label: L('Cleaning £/mo', 'Прибирання £/міс'), k: 'cleaningMonthly', w: 'w-24' })}
        {F({ label: L('Other £/mo', 'Інше £/міс'), k: 'otherMonthly', w: 'w-24' })}
      </Group>
      <Group title={L('Marketing', 'Маркетинг')}>
        {F({ label: L('% of net revenue Y1', '% доходу Р1'), k: 'mk1', w: 'w-20' })}
        {F({ label: 'Y2', k: 'mk2', w: 'w-20' })}
        {F({ label: 'Y3', k: 'mk3', w: 'w-20' })}
        {F({ label: L('Monthly floor £', 'Мінімум £/міс'), k: 'floorMonthly', w: 'w-24' })}
      </Group>
      <Group title={L('VAT', 'ПДВ')}>
        {F({ label: L('Registration threshold £', 'Поріг реєстрації £'), k: 'vatThreshold' })}
        {F({ label: L('Prior 12-mo turnover £', 'Оборот за попередні 12 міс £'), k: 'priorTurnover' })}
        {F({ label: L('Force registration from month (0 = auto)', 'Примусово з місяця (0 = авто)'), k: 'vatOverrideMonth', w: 'w-24' })}
        <span className="self-end pb-2 text-xs text-[var(--color-stone)]">
          {plan.vatCrossingMonth
            ? `${L('Model registers you in month', 'Реєстрація в місяці')} ${plan.vatCrossingMonth}`
            : L('Threshold not crossed in horizon', 'Поріг не перетинається')}
        </span>
      </Group>
      {canManage && (
        <SaveRow onSave={saveAll} msg={msg} uk={uk}
          extra={<button onClick={resetAll} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]">{L('Reset to defaults', 'Скинути до типових')}</button>} />
      )}
    </div>
  );
}
