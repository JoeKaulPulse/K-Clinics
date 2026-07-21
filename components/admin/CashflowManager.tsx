'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Cfg = { openingPence: number; safetyFloorPence: number; months: number };
type Drivers = { monthlyVisitors: number; conversionPct: number; avgValuePence: number; monthlyNewClients: number; industryGrowthPct: number; seoRank: number; useSeasonality: boolean; useBookings: boolean };
type Month = { label: string; incomePence: number; committedPence: number; modelledPence: number; expensePence: number; netPence: number; reserveContribPence: number; operatingPence: number; reservesPence: number; belowFloor: boolean };
type Reserve = { id: string; name: string; color: string | null; targetPence: number; startPence: number; endPence: number; monthlyContributionPence: number };
type Entry = { id: string; type: string; category: string; label: string; amountPence: number; cadence: string; startDate: string | null; endDate: string | null };
type Summary = { endOperating: number; endReserves: number; lowestOperating: number; everBelowFloor: boolean };
type Balance = { source: string; label: string; connected: boolean; availablePence: number; pendingPence: number; currency: string; detail?: string };

const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

async function post(payload: object) {
  const res = await fetch('/api/admin/cashflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

export function CashflowManager({ cfg, drivers, consumablesMonthly, months, reserves, summary, entries, balances, canManage, uk }: {
  cfg: Cfg; drivers: Drivers; consumablesMonthly: number; months: Month[]; reserves: Reserve[]; summary: Summary; entries: Entry[]; balances: Balance[]; canManage: boolean; uk: boolean;
}) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  return (
    <div className="space-y-10">
      <LiveBalances balances={balances} canManage={canManage} uk={uk} />
      <ConfigBar cfg={cfg} canManage={canManage} uk={uk} />
      <DriversPanel drivers={drivers} consumablesMonthly={consumablesMonthly} canManage={canManage} uk={uk} />

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: L('Opening cash', 'Початковий баланс'), value: gbp(cfg.openingPence), tone: '' },
          { label: L(`Operating cash · month ${cfg.months}`, `Операційні кошти · міс ${cfg.months}`), value: gbp(summary.endOperating), tone: summary.endOperating < cfg.safetyFloorPence ? 'text-[var(--color-blush-deep)]' : '' },
          { label: L('Ring-fenced reserves', 'Захищені резерви'), value: gbp(summary.endReserves), tone: 'text-[var(--color-jade)]' },
          { label: L('Lowest operating point', 'Найнижча точка'), value: gbp(summary.lowestOperating), tone: summary.everBelowFloor ? 'text-[var(--color-blush-deep)]' : '' },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <div className={`font-[family-name:var(--font-display)] text-2xl ${s.tone} tabular-nums`}>{s.value}</div>
            <div className="mt-1 text-xs text-[var(--color-stone)]">{s.label}</div>
          </div>
        ))}
      </div>
      {summary.everBelowFloor && (
        <p className="-mt-6 rounded-[var(--radius-sm)] border border-[var(--color-blush)]/40 bg-[var(--color-blush)]/10 px-4 py-3 text-sm text-[var(--color-ink)]">
          ⚠ {L('Operating cash dips below your safety floor during the forecast. Reduce reserve contributions, defer spend, or raise income.', 'Операційні кошти опускаються нижче порогу безпеки. Зменшіть внески в резерви, відкладіть витрати або збільшіть дохід.')}
        </p>
      )}

      {/* Forecast table */}
      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">{L('Monthly projection', 'Помісячний прогноз')}</h2>
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[760px] text-sm tabular-nums">
            <thead className="bg-[var(--color-bone)] text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <tr>
                {[L('Month', 'Місяць'), L('Income', 'Дохід'), L('of which booked', 'із них заброньовано'), L('Expenses', 'Витрати'), L('Net', 'Чистий'), L('To reserves', 'У резерви'), L('Operating', 'Операційні'), L('Reserves', 'Резерви')].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => (
                <tr key={i} className="border-t border-[var(--color-line)] bg-[var(--color-porcelain)]">
                  <td className="px-4 py-2.5 font-medium">{m.label}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-jade)]">{gbp(m.incomePence)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-stone)]" title={L('Confirmed/pending bookings', 'Підтверджені/очікувані записи')}>{m.committedPence > 0 ? gbp(m.committedPence) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{gbp(m.expensePence)}</td>
                  <td className={`px-4 py-2.5 text-right ${m.netPence < 0 ? 'text-[var(--color-blush-deep)]' : ''}`}>{gbp(m.netPence)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-stone)]">{gbp(m.reserveContribPence)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${m.belowFloor ? 'text-[var(--color-blush-deep)]' : ''}`}>{gbp(m.operatingPence)}{m.belowFloor ? ' ⚠' : ''}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-jade)]">{gbp(m.reservesPence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Reserves reserves={reserves} canManage={canManage} uk={uk} />
        <Entries entries={entries} canManage={canManage} uk={uk} />
      </div>
    </div>
  );
}

function LiveBalances({ balances, canManage, uk }: { balances: Balance[]; canManage: boolean; uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const connectedTotal = balances.filter((b) => b.connected).reduce((s, b) => s + b.availablePence, 0);
  const anyConnected = balances.some((b) => b.connected);

  async function useAsOpening() {
    if (await post({ op: 'config', openingPounds: connectedTotal / 100 })) router.refresh();
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Live balances', 'Поточні баланси')}</h2>
        {anyConnected && canManage && <button onClick={useAsOpening} className="text-sm text-[var(--color-gold-deep)] hover:underline">{L('Use as opening cash', 'Як початковий баланс')}</button>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {balances.map((b) => (
          <div key={b.source} className={`rounded-[var(--radius-md)] border p-4 ${b.connected ? 'border-[var(--color-line)] bg-white' : 'border-dashed border-[var(--color-line)]'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{b.label}</span>
              <span className={`h-2 w-2 rounded-full ${b.connected ? 'bg-green-500' : 'bg-[var(--color-stone-soft)]'}`} />
            </div>
            {b.connected ? (
              <>
                <div className="mt-1 font-[family-name:var(--font-display)] text-2xl tabular-nums">{gbp(b.availablePence)}</div>
                {b.pendingPence > 0 && <p className="text-xs text-[var(--color-stone)]">{gbp(b.pendingPence)} {L('pending', 'в очікуванні')}</p>}
              </>
            ) : (
              <p className="mt-2 text-xs text-[var(--color-stone)]">{b.detail || L('Not connected', 'Не підключено')}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfigBar({ cfg, canManage, uk }: { cfg: Cfg; canManage: boolean; uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [opening, setOpening] = useState(String(cfg.openingPence / 100));
  const [floor, setFloor] = useState(String(cfg.safetyFloorPence / 100));
  const [months, setMonths] = useState(String(cfg.months));
  const [msg, setMsg] = useState('');

  async function save() {
    const ok = await post({ op: 'config', openingPounds: Number(opening), floorPounds: Number(floor), months: Number(months) });
    setMsg(ok ? L('Saved ✓', 'Збережено ✓') : L('Could not save', 'Помилка'));
    if (ok) router.refresh();
  }

  return (
    <section className="flex flex-wrap items-end gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <label className="text-xs text-[var(--color-stone)]">{L('Opening cash (£)', 'Початковий баланс (£)')}
        <input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} disabled={!canManage} className={`${field} mt-1 block w-36`} />
      </label>
      <label className="text-xs text-[var(--color-stone)]">{L('Safety floor (£)', 'Поріг безпеки (£)')}
        <input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} disabled={!canManage} className={`${field} mt-1 block w-36`} />
      </label>
      <label className="text-xs text-[var(--color-stone)]">{L('Horizon (months)', 'Горизонт (міс)')}
        <input type="number" value={months} onChange={(e) => setMonths(e.target.value)} disabled={!canManage} className={`${field} mt-1 block w-28`} />
      </label>
      {canManage && <button onClick={save} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">{L('Update', 'Оновити')}</button>}
      {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
    </section>
  );
}

function DriversPanel({ drivers, consumablesMonthly, canManage, uk }: { drivers: Drivers; consumablesMonthly: number; canManage: boolean; uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({
    monthlyVisitors: String(drivers.monthlyVisitors), conversionPct: String(drivers.conversionPct),
    avgValuePounds: String(drivers.avgValuePence / 100), monthlyNewClients: String(drivers.monthlyNewClients),
    industryGrowthPct: String(drivers.industryGrowthPct), seoRank: String(drivers.seoRank),
    useSeasonality: drivers.useSeasonality, useBookings: drivers.useBookings,
  });
  const [msg, setMsg] = useState('');
  const setN = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });

  async function save() {
    const ok = await post({ op: 'drivers', ...d });
    setMsg(ok ? L('Saved ✓', 'Збережено ✓') : L('Could not save', 'Помилка'));
    if (ok) router.refresh();
  }

  const monthlyModelled = Math.max(
    drivers.monthlyVisitors * (drivers.conversionPct / 100) * (drivers.avgValuePence / 100),
    drivers.monthlyNewClients * (drivers.avgValuePence / 100),
  );

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Prediction drivers', 'Драйвери прогнозу')}</h2>
        <button onClick={() => setOpen((o) => !o)} className="text-sm text-[var(--color-gold-deep)] hover:underline">{open ? L('Hide', 'Сховати') : L('Edit assumptions', 'Редагувати')}</button>
      </div>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {L(
          `Income is modelled from these drivers and your real bookings, with seasonality applied. ~${gbp(Math.round(monthlyModelled * 100))}/mo modelled demand · consumables run-rate ${gbp(consumablesMonthly)}/mo.`,
          `Дохід моделюється з цих драйверів і реальних записів із сезонністю. ~${gbp(Math.round(monthlyModelled * 100))}/міс попиту · витратні ${gbp(consumablesMonthly)}/міс.`,
        )}
      </p>

      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-[var(--color-stone)]">{L('Website visitors / mo', 'Відвідувачі / міс')}<input type="number" value={d.monthlyVisitors} onChange={setN('monthlyVisitors')} disabled={!canManage} className={`${field} mt-1`} /></label>
          <label className="text-xs text-[var(--color-stone)]">{L('Visitor → booking %', 'Конверсія %')}<input type="number" step="0.1" value={d.conversionPct} onChange={setN('conversionPct')} disabled={!canManage} className={`${field} mt-1`} /></label>
          <label className="text-xs text-[var(--color-stone)]">{L('Avg treatment value (£)', 'Середній чек (£)')}<input type="number" value={d.avgValuePounds} onChange={setN('avgValuePounds')} disabled={!canManage} className={`${field} mt-1`} /></label>
          <label className="text-xs text-[var(--color-stone)]">{L('New clients / mo (alt)', 'Нові клієнти / міс')}<input type="number" value={d.monthlyNewClients} onChange={setN('monthlyNewClients')} disabled={!canManage} className={`${field} mt-1`} /></label>
          <label className="text-xs text-[var(--color-stone)]">{L('Industry growth % / yr', 'Зростання % / рік')}<input type="number" step="0.1" value={d.industryGrowthPct} onChange={setN('industryGrowthPct')} disabled={!canManage} className={`${field} mt-1`} /></label>
          <label className="text-xs text-[var(--color-stone)]">{L('Avg search rank', 'Позиція в пошуку')}<input type="number" value={d.seoRank} onChange={setN('seoRank')} disabled={!canManage} className={`${field} mt-1`} /></label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={d.useSeasonality} onChange={(e) => setD({ ...d, useSeasonality: e.target.checked })} disabled={!canManage} className="h-4 w-4 accent-[var(--color-gold)]" />{L('Apply seasonality', 'Сезонність')}</label>
          <label className="flex items-center gap-2 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={d.useBookings} onChange={(e) => setD({ ...d, useBookings: e.target.checked })} disabled={!canManage} className="h-4 w-4 accent-[var(--color-gold)]" />{L('Use confirmed bookings', 'Враховувати записи')}</label>
          {canManage && <div className="flex items-center gap-3"><button onClick={save} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">{L('Save drivers', 'Зберегти')}</button>{msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}</div>}
        </div>
      )}
      {open && (
        <p className="mt-3 text-xs text-[var(--color-stone)]">
          {L('Visitors and search rank will auto-populate once Analytics/Search Console are connected; bank, Stripe and Xero balances arrive with those integrations (coming next).',
             'Відвідувачі та позиції оновлюватимуться після підключення Аналітики; баланси банку, Stripe і Xero — з наступними інтеграціями.')}
        </p>
      )}
    </section>
  );
}

function Reserves({ reserves, canManage, uk }: { reserves: Reserve[]; canManage: boolean; uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: '', targetPounds: '', balancePounds: '', monthlyPounds: '' });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function add() {
    if (!v.name.trim()) return;
    if (await post({ op: 'createReserve', ...v })) { setV({ name: '', targetPounds: '', balancePounds: '', monthlyPounds: '' }); setOpen(false); router.refresh(); }
  }
  async function del(id: string) { if (confirm(L('Delete this reserve?', 'Видалити резерв?')) && await post({ op: 'deleteReserve', id })) router.refresh(); }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Ring-fenced reserves', 'Захищені резерви')}</h2>
        {canManage && <button onClick={() => setOpen((o) => !o)} className="text-sm text-[var(--color-gold-deep)] hover:underline">{open ? L('Close', 'Закрити') : L('+ Add', '+ Додати')}</button>}
      </div>
      {open && canManage && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
          <input value={v.name} onChange={set('name')} placeholder={L('Name (e.g. Refurbishment)', 'Назва (напр. Ремонт)')} aria-label={L('Name', 'Назва')} className={`${field} col-span-2`} />
          <input type="number" value={v.balancePounds} onChange={set('balancePounds')} placeholder={L('Current £', 'Поточний £')} aria-label={L('Current balance (£)', 'Поточний баланс (£)')} className={field} />
          <input type="number" value={v.targetPounds} onChange={set('targetPounds')} placeholder={L('Target £ (0 = none)', 'Ціль £ (0 = без)')} aria-label={L('Target (£)', 'Ціль (£)')} className={field} />
          <input type="number" value={v.monthlyPounds} onChange={set('monthlyPounds')} placeholder={L('Monthly top-up £', 'Щомісячно £')} aria-label={L('Monthly top-up (£)', 'Щомісячне поповнення (£)')} className={field} />
          <button onClick={add} className="rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm text-white">{L('Add', 'Додати')}</button>
        </div>
      )}
      <div className="space-y-3">
        {reserves.length === 0 && <p className="text-sm text-[var(--color-stone)]">{L('No reserves yet. Add pots for replenishment, refurbishment, incentives, salary uplifts and an operating slush fund.', 'Ще немає резервів. Додайте фонди для поповнення, ремонту, бонусів, підвищення зарплат і операційного запасу.')}</p>}
        {reserves.map((r) => {
          const pct = r.targetPence > 0 ? Math.min(100, Math.round((r.endPence / r.targetPence) * 100)) : 0;
          return (
            <div key={r.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color || 'var(--color-jade)' }} />{r.name}</span>
                <span className="text-sm tabular-nums">{gbp(r.endPence)}{r.targetPence > 0 ? ` / ${gbp(r.targetPence)}` : ''}</span>
              </div>
              {r.targetPence > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bone)]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color || 'var(--color-jade)' }} />
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-stone)]">
                <span>{L('Now', 'Зараз')} {gbp(r.startPence)} · +{gbp(r.monthlyContributionPence)}/{L('mo', 'міс')}</span>
                {canManage && <button onClick={() => del(r.id)} className="hover:text-[var(--color-blush-deep)]">{L('Delete', 'Видалити')}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Entries({ entries, canManage, uk }: { entries: Entry[]; canManage: boolean; uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ type: 'INCOME', category: '', label: '', amountPounds: '', cadence: 'MONTHLY', startDate: '', endDate: '' });
  const setS = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function add() {
    if (!v.label.trim()) return;
    if (await post({ op: 'createEntry', ...v })) { setV({ type: 'INCOME', category: '', label: '', amountPounds: '', cadence: 'MONTHLY', startDate: '', endDate: '' }); setOpen(false); router.refresh(); }
  }
  async function del(id: string) { if (!confirm(L('Delete this forecast line?', 'Видалити цей рядок прогнозу?'))) return; if (await post({ op: 'deleteEntry', id })) router.refresh(); }

  const cadenceLabel = (c: string) => ({ ONE_OFF: L('one-off', 'разово'), WEEKLY: L('weekly', 'щотижня'), MONTHLY: L('monthly', 'щомісяця'), QUARTERLY: L('quarterly', 'щокварталу'), ANNUAL: L('annual', 'щороку') }[c] || c);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{L('Income & expense lines', 'Статті доходів і витрат')}</h2>
        {canManage && <button onClick={() => setOpen((o) => !o)} className="text-sm text-[var(--color-gold-deep)] hover:underline">{open ? L('Close', 'Закрити') : L('+ Add', '+ Додати')}</button>}
      </div>
      {open && canManage && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
          <select value={v.type} onChange={setS('type')} className={field}><option value="INCOME">{L('Income', 'Дохід')}</option><option value="EXPENSE">{L('Expense', 'Витрата')}</option></select>
          <select value={v.cadence} onChange={setS('cadence')} className={field}>{['ONE_OFF', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'].map((c) => <option key={c} value={c}>{cadenceLabel(c)}</option>)}</select>
          <input value={v.label} onChange={setS('label')} placeholder={L('Label (e.g. Rent)', 'Назва (напр. Оренда)')} aria-label={L('Label', 'Назва')} className={`${field} col-span-2`} />
          <input value={v.category} onChange={setS('category')} placeholder={L('Category', 'Категорія')} aria-label={L('Category', 'Категорія')} className={field} />
          <input type="number" value={v.amountPounds} onChange={setS('amountPounds')} placeholder={L('Amount £', 'Сума £')} aria-label={L('Amount (£)', 'Сума (£)')} className={field} />
          <button onClick={add} className="col-span-2 rounded-full bg-[var(--color-gold-deep)] px-4 py-2 text-sm text-white">{L('Add line', 'Додати')}</button>
        </div>
      )}
      <div className="space-y-1.5">
        {entries.length === 0 && <p className="text-sm text-[var(--color-stone)]">{L('No lines yet. Add recurring income (treatments, retail) and expenses (rent, salaries, consumables, marketing).', 'Ще немає статей. Додайте регулярні доходи й витрати.')}</p>}
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${e.type === 'INCOME' ? 'bg-[var(--color-jade)]' : 'bg-[var(--color-blush)]'}`} />
              <span className="font-medium">{e.label}</span>
              <span className="text-xs text-[var(--color-stone)]">{e.category} · {cadenceLabel(e.cadence)}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className={`${e.type === 'INCOME' ? 'text-[var(--color-jade)]' : 'text-[var(--color-stone)]'} tabular-nums`}>{gbp(e.amountPence)}</span>
              {canManage && <button onClick={() => del(e.id)} aria-label="Delete entry" className="text-xs text-[var(--color-stone)] hover:text-[var(--color-blush-deep)]">✕</button>}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
