'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = {
  id: string; name: string; category: string | null; brand: string | null; size: string | null;
  unit: string; sku: string | null; supplier: string | null; moq: number;
  currentQty: number; lowStockAt: number; costPence: number | null; retailPence: number | null; isRetail: boolean;
};
type Expiring = { id: string; itemName: string; unit: string; batchNo: string | null; expiry: string; qty: number };

async function post(payload: object) {
  const res = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
const gbp = (p: number | null) => (p == null ? null : `£${(p / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`);

export function InventoryManager({ items, expiring, canManage, uk, hasISClinical }: { items: Item[]; expiring: Expiring[]; canManage: boolean; uk: boolean; hasISClinical: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const lowStock = items.filter((i) => i.lowStockAt > 0 && i.currentQty <= i.lowStockAt);
  const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);

  // Group by category.
  const groups = new Map<string, Item[]>();
  for (const i of items) {
    const k = i.category || L('Uncategorised', 'Без категорії');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }

  return (
    <div className="space-y-8">
      {/* Alerts */}
      {(lowStock.length > 0 || expiring.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {lowStock.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-blush)]/40 bg-[var(--color-blush)]/10 p-4">
              <h3 className="mb-2 text-sm font-medium text-[var(--color-ink)]">⚠ {L('Reorder needed', 'Потрібно замовити')} ({lowStock.length})</h3>
              <ul className="space-y-1 text-sm text-[var(--color-stone)]">
                {lowStock.map((i) => {
                  // Suggest an order rounded up to the supplier MOQ.
                  const shortfall = Math.max(i.moq, Math.ceil((i.lowStockAt - i.currentQty) || i.moq));
                  const order = Math.ceil(shortfall / i.moq) * i.moq;
                  return (
                    <li key={i.id}>
                      {i.name} — <span className="font-medium text-[var(--color-blush-deep)] tabular-nums">{i.currentQty} {i.unit}</span>{' '}
                      <span className="text-xs">→ {L('order', 'замовити')} <span className="font-medium">{order}</span> ({L('MOQ', 'МОЗ')} {i.moq})</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {expiring.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-4">
              <h3 className="mb-2 text-sm font-medium text-amber-900">⏳ {L('Expiring within 90 days', 'Спливає протягом 90 днів')} ({expiring.length})</h3>
              <ul className="space-y-1 text-sm text-amber-900">
                {expiring.map((e) => (
                  <li key={e.id}>
                    {e.itemName}{e.batchNo ? ` · ${L('batch', 'партія')} ${e.batchNo}` : ''} — {new Date(e.expiry).toLocaleDateString('en-GB')} <span className="text-xs">({daysTo(e.expiry)}d)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <AddItem uk={uk} />
          <ImportBrand uk={uk} hasISClinical={hasISClinical} />
        </div>
      )}

      {/* Item list */}
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-stone)]">{L('No stock items yet.', 'Ще немає позицій на складі.')}</p>
      ) : (
        Array.from(groups.entries()).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-stone)]">{cat}</h2>
            <div className="space-y-2">
              {list.map((i) => <ItemRow key={i.id} item={i} canManage={canManage} uk={uk} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function ImportBrand({ uk, hasISClinical }: { uk: boolean; hasISClinical: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run() {
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/inventory/import-brand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand: 'is-clinical' }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && j.ok) { setMsg(`✓ ${j.created} ${L('added', 'додано')}, ${j.updated} ${L('updated', 'оновлено')}`); router.refresh(); }
    else setMsg(j.error || L('Import failed', 'Помилка імпорту'));
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={run} disabled={busy} className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm hover:bg-[var(--color-bone)] disabled:opacity-60">
        {busy ? L('Importing…', 'Імпорт…') : hasISClinical ? L('Re-sync iS Clinical', 'Оновити iS Clinical') : L('Import iS Clinical range', 'Імпортувати iS Clinical')}
      </button>
      {msg && <span className="text-xs text-[var(--color-stone)]">{msg}</span>}
    </div>
  );
}

function ItemRow({ item, canManage, uk }: { item: Item; canManage: boolean; uk: boolean }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const low = item.lowStockAt > 0 && item.currentQty <= item.lowStockAt;

  return (
    <div className={`rounded-[var(--radius-md)] border bg-[var(--color-porcelain)] p-4 ${low ? 'border-[var(--color-blush)]/50' : 'border-[var(--color-line)]'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{item.name}</span>
            {item.size && <span className="text-xs text-[var(--color-stone)]">{item.size}</span>}
            {item.sku && <span className="text-xs text-[var(--color-stone)]">#{item.sku}</span>}
            {item.isRetail && <span className="rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-ink)]">{L('retail', 'роздріб')}</span>}
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-stone)]">
            {[item.brand, item.supplier].filter(Boolean).join(' · ')}
            {item.costPence != null ? ` · ${L('cost', 'собів.')} ${gbp(item.costPence)}` : ''}
            {item.retailPence != null ? ` · ${L('RRP', 'РРЦ')} ${gbp(item.retailPence)}` : ''}
            {` · ${L('MOQ', 'МОЗ')} ${item.moq}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`font-[family-name:var(--font-display)] text-lg leading-none tabular-nums ${low ? 'text-[var(--color-blush-deep)]' : ''}`}>{item.currentQty}</div>
            <div className="text-xs text-[var(--color-stone)]">{item.unit}</div>
          </div>
          {canManage && (
            <div className="flex flex-col gap-1">
              <button onClick={() => { setOpen((v) => !v); setEdit(false); }} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:bg-[var(--color-bone)]">{open ? L('Close', 'Закрити') : L('Stock', 'Рух')}</button>
              <button onClick={() => { setEdit((v) => !v); setOpen(false); }} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:bg-[var(--color-bone)]">{edit ? L('Close', 'Закрити') : L('Edit', 'Ред.')}</button>
            </div>
          )}
        </div>
      </div>
      {open && canManage && <MoveForm itemId={item.id} unit={item.unit} moq={item.moq} uk={uk} onDone={() => setOpen(false)} />}
      {edit && canManage && <EditForm item={item} uk={uk} onDone={() => setEdit(false)} />}
    </div>
  );
}

function MoveForm({ itemId, unit, moq, uk, onDone }: { itemId: string; unit: string; moq: number; uk: boolean; onDone: () => void }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [reason, setReason] = useState('RECEIVED');
  const [qty, setQty] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [expiry, setExpiry] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit() {
    if (!qty || Number(qty) <= 0) { setMsg(L('Enter a quantity.', 'Вкажіть кількість.')); return; }
    setBusy(true); setMsg('');
    const ok = await post({ op: 'move', itemId, qty: Number(qty), reason, batchNo, expiry, note });
    setBusy(false);
    if (ok) { router.refresh(); onDone(); } else setMsg(L('Could not save.', 'Не вдалося зберегти.'));
  }

  const reasons = [
    { v: 'RECEIVED', l: L('Receive (in)', 'Прихід') },
    { v: 'USED', l: L('Use (out)', 'Використано') },
    { v: 'WASTED', l: L('Waste (out)', 'Списано') },
    { v: 'RETURNED', l: L('Return (out)', 'Повернення') },
    { v: 'ADJUSTMENT', l: L('Adjustment (±)', 'Коригування (±)') },
  ];

  return (
    <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-2">
      <label className="text-xs text-[var(--color-stone)]">{L('Movement', 'Рух')}
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>{reasons.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
      </label>
      <label className="text-xs text-[var(--color-stone)]">{L('Quantity', 'Кількість')} ({unit}){reason === 'ADJUSTMENT' ? ' ±' : ''}
        <input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={field} />
        {reason === 'RECEIVED' && moq > 1 && <span className="mt-1 block text-[0.65rem] text-[var(--color-stone)]">{L('Supplier MOQ', 'МОЗ постачальника')}: {moq}</span>}
      </label>
      {reason === 'RECEIVED' && (
        <>
          <label className="text-xs text-[var(--color-stone)]">{L('Batch / lot no.', 'Номер партії')}
            <input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} className={field} />
          </label>
          <label className="text-xs text-[var(--color-stone)]">{L('Expiry', 'Термін придатності')}
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={field} />
          </label>
        </>
      )}
      <label className="text-xs text-[var(--color-stone)] sm:col-span-2">{L('Note (optional)', 'Примітка (необов’язково)')}
        <input value={note} onChange={(e) => setNote(e.target.value)} className={field} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
          {busy ? L('Saving…', 'Збереження…') : L('Record', 'Записати')}
        </button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </div>
  );
}

function EditForm({ item, uk, onDone }: { item: Item; uk: boolean; onDone: () => void }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [v, setV] = useState({
    name: item.name, category: item.category || '', brand: item.brand || '', size: item.size || '', supplier: item.supplier || '',
    moq: String(item.moq), cost: item.costPence != null ? String(item.costPence / 100) : '',
    retail: item.retailPence != null ? String(item.retailPence / 100) : '',
    lowStockAt: String(item.lowStockAt), isRetail: item.isRetail,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function save() {
    setBusy(true);
    const ok = await post({
      op: 'updateItem', id: item.id, name: v.name, category: v.category, brand: v.brand, size: v.size, supplier: v.supplier,
      moq: Number(v.moq) || 1,
      costPence: v.cost === '' ? '' : Math.round(Number(v.cost) * 100),
      retailPence: v.retail === '' ? '' : Math.round(Number(v.retail) * 100),
      lowStockAt: Number(v.lowStockAt) || 0, isRetail: v.isRetail,
    });
    setBusy(false);
    if (ok) { router.refresh(); onDone(); }
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-[var(--color-line)] pt-4 sm:grid-cols-2">
      <label className="text-xs text-[var(--color-stone)] sm:col-span-2">{L('Name', 'Назва')}<input value={v.name} onChange={set('name')} className={field} /></label>
      <label className="text-xs text-[var(--color-stone)]">{L('Brand', 'Бренд')}<input value={v.brand} onChange={set('brand')} className={field} /></label>
      <label className="text-xs text-[var(--color-stone)]">{L('Category', 'Категорія')}<input value={v.category} onChange={set('category')} className={field} /></label>
      <label className="text-xs text-[var(--color-stone)]">{L('Size', 'Розмір')}<input value={v.size} onChange={set('size')} className={field} /></label>
      <label className="text-xs text-[var(--color-stone)]">{L('Supplier', 'Постачальник')}<input value={v.supplier} onChange={set('supplier')} className={field} /></label>
      <label className="text-xs text-[var(--color-stone)]">{L('Unit cost / wholesale (£)', 'Собівартість (£)')}<input type="number" step="0.01" value={v.cost} onChange={set('cost')} className={field} /></label>
      <label className="text-xs text-[var(--color-stone)]">{L('Retail / RRP (£)', 'Роздрібна / РРЦ (£)')}<input type="number" step="0.01" value={v.retail} onChange={set('retail')} className={field} /></label>
      <label className="text-xs text-[var(--color-stone)]">{L('MOQ', 'МОЗ')}<input type="number" value={v.moq} onChange={set('moq')} className={field} /></label>
      <label className="text-xs text-[var(--color-stone)]">{L('Low-stock at', 'Поріг низького запасу')}<input type="number" step="any" value={v.lowStockAt} onChange={set('lowStockAt')} className={field} /></label>
      <label className="flex items-center gap-2 text-xs text-[var(--color-stone)] sm:col-span-2"><input type="checkbox" checked={v.isRetail} onChange={(e) => setV({ ...v, isRetail: e.target.checked })} className="h-4 w-4 accent-[var(--color-gold)]" />{L('Sold to clients (retail)', 'Продається клієнтам (роздріб)')}</label>
      <div className="sm:col-span-2"><button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? L('Saving…', 'Збереження…') : L('Save', 'Зберегти')}</button></div>
    </div>
  );
}

function AddItem({ uk }: { uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: '', category: '', brand: '', size: '', unit: 'unit', sku: '', supplier: '', moq: '1', lowStockAt: '', costPence: '', retailPence: '', isRetail: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit() {
    if (!v.name.trim()) { setMsg(L('Add a name.', 'Вкажіть назву.')); return; }
    setBusy(true); setMsg('');
    const ok = await post({
      op: 'createItem', name: v.name, category: v.category, brand: v.brand, size: v.size, unit: v.unit, sku: v.sku, supplier: v.supplier,
      moq: Number(v.moq) || 1, lowStockAt: Number(v.lowStockAt) || 0,
      costPence: v.costPence ? Math.round(Number(v.costPence) * 100) : '',
      retailPence: v.retailPence ? Math.round(Number(v.retailPence) * 100) : '',
      isRetail: v.isRetail,
    });
    setBusy(false);
    if (ok) { setV({ name: '', category: '', brand: '', size: '', unit: 'unit', sku: '', supplier: '', moq: '1', lowStockAt: '', costPence: '', retailPence: '', isRetail: false }); setOpen(false); router.refresh(); }
    else setMsg(L('Could not add.', 'Не вдалося додати.'));
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">+ {L('Add stock item', 'Додати позицію')}</button>;

  return (
    <section className="w-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{L('New stock item', 'Нова позиція')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[var(--color-stone)] sm:col-span-2">{L('Name', 'Назва')}<input value={v.name} onChange={set('name')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Brand', 'Бренд')}<input value={v.brand} onChange={set('brand')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Category', 'Категорія')}<input value={v.category} onChange={set('category')} placeholder={L('e.g. Injectables', 'напр. Інʼєкційні')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Size', 'Розмір')}<input value={v.size} onChange={set('size')} placeholder="180ml" className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Unit', 'Одиниця')}<input value={v.unit} onChange={set('unit')} placeholder="vial / ml / unit" className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('SKU', 'Артикул')}<input value={v.sku} onChange={set('sku')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Supplier', 'Постачальник')}<input value={v.supplier} onChange={set('supplier')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('MOQ', 'МОЗ')}<input type="number" value={v.moq} onChange={set('moq')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Low-stock alert at', 'Поріг низького запасу')}<input type="number" step="any" value={v.lowStockAt} onChange={set('lowStockAt')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Unit cost (£)', 'Вартість одиниці (£)')}<input type="number" step="0.01" value={v.costPence} onChange={set('costPence')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Retail / RRP (£)', 'Роздрібна / РРЦ (£)')}<input type="number" step="0.01" value={v.retailPence} onChange={set('retailPence')} className={field} /></label>
        <label className="flex items-center gap-2 text-xs text-[var(--color-stone)] sm:col-span-2"><input type="checkbox" checked={v.isRetail} onChange={(e) => setV({ ...v, isRetail: e.target.checked })} className="h-4 w-4 accent-[var(--color-gold)]" />{L('Sold to clients (retail)', 'Продається клієнтам (роздріб)')}</label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? L('Adding…', 'Додавання…') : L('Add item', 'Додати')}</button>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-stone)]">{L('Cancel', 'Скасувати')}</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}
