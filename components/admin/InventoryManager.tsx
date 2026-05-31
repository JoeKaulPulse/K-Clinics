'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Item = {
  id: string; name: string; category: string | null; unit: string; sku: string | null; supplier: string | null;
  currentQty: number; lowStockAt: number; costPence: number | null;
};
type Expiring = { id: string; itemName: string; unit: string; batchNo: string | null; expiry: string; qty: number };

async function post(payload: object) {
  const res = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

export function InventoryManager({ items, expiring, canManage, uk }: { items: Item[]; expiring: Expiring[]; canManage: boolean; uk: boolean }) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const lowStock = items.filter((i) => i.lowStockAt > 0 && i.currentQty <= i.lowStockAt);

  // Group by category.
  const groups = new Map<string, Item[]>();
  for (const i of items) {
    const k = i.category || L('Uncategorised', 'Без категорії');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }

  const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5);

  return (
    <div className="space-y-8">
      {/* Alerts */}
      {(lowStock.length > 0 || expiring.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {lowStock.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-blush)]/40 bg-[var(--color-blush)]/10 p-4">
              <h3 className="mb-2 text-sm font-medium text-[var(--color-ink)]">⚠ {L('Low stock', 'Низький запас')} ({lowStock.length})</h3>
              <ul className="space-y-1 text-sm text-[var(--color-stone)]">
                {lowStock.map((i) => <li key={i.id}>{i.name} — <span className="font-medium text-[var(--color-blush)]">{i.currentQty} {i.unit}</span> {L('left', 'залишилось')}</li>)}
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

      {canManage && <AddItem uk={uk} />}

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

function ItemRow({ item, canManage, uk }: { item: Item; canManage: boolean; uk: boolean }) {
  const [open, setOpen] = useState(false);
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const low = item.lowStockAt > 0 && item.currentQty <= item.lowStockAt;

  return (
    <div className={`rounded-[var(--radius-md)] border bg-[var(--color-porcelain)] p-4 ${low ? 'border-[var(--color-blush)]/50' : 'border-[var(--color-line)]'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{item.name}</span>
            {item.sku && <span className="text-xs text-[var(--color-stone-soft)]">{item.sku}</span>}
          </div>
          {item.supplier && <p className="text-xs text-[var(--color-stone-soft)]">{item.supplier}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`font-[family-name:var(--font-display)] text-lg leading-none ${low ? 'text-[var(--color-blush)]' : ''}`}>{item.currentQty}</div>
            <div className="text-xs text-[var(--color-stone-soft)]">{item.unit}</div>
          </div>
          {canManage && (
            <button onClick={() => setOpen((v) => !v)} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)]">
              {open ? L('Close', 'Закрити') : L('Adjust', 'Змінити')}
            </button>
          )}
        </div>
      </div>
      {open && canManage && <MoveForm itemId={item.id} unit={item.unit} uk={uk} onDone={() => setOpen(false)} />}
    </div>
  );
}

function MoveForm({ itemId, unit, uk, onDone }: { itemId: string; unit: string; uk: boolean; onDone: () => void }) {
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
      <label className="text-xs text-[var(--color-stone)] sm:col-span-2">{L('Note (optional)', 'Примітка (необовʼязково)')}
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

function AddItem({ uk }: { uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ name: '', category: '', unit: 'unit', sku: '', supplier: '', lowStockAt: '', costPence: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit() {
    if (!v.name.trim()) { setMsg(L('Add a name.', 'Вкажіть назву.')); return; }
    setBusy(true); setMsg('');
    const ok = await post({ op: 'createItem', ...v, lowStockAt: Number(v.lowStockAt) || 0, costPence: v.costPence ? Math.round(Number(v.costPence) * 100) : '' });
    setBusy(false);
    if (ok) { setV({ name: '', category: '', unit: 'unit', sku: '', supplier: '', lowStockAt: '', costPence: '' }); setOpen(false); router.refresh(); }
    else setMsg(L('Could not add.', 'Не вдалося додати.'));
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)]">+ {L('Add stock item', 'Додати позицію')}</button>;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{L('New stock item', 'Нова позиція')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[var(--color-stone)] sm:col-span-2">{L('Name', 'Назва')}<input value={v.name} onChange={set('name')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Category', 'Категорія')}<input value={v.category} onChange={set('category')} placeholder={L('e.g. Injectables', 'напр. Інʼєкційні')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Unit', 'Одиниця')}<input value={v.unit} onChange={set('unit')} placeholder="vial / ml / unit" className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('SKU', 'Артикул')}<input value={v.sku} onChange={set('sku')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Supplier', 'Постачальник')}<input value={v.supplier} onChange={set('supplier')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Low-stock alert at', 'Поріг низького запасу')}<input type="number" step="any" value={v.lowStockAt} onChange={set('lowStockAt')} className={field} /></label>
        <label className="text-xs text-[var(--color-stone)]">{L('Unit cost (£)', 'Вартість одиниці (£)')}<input type="number" step="0.01" value={v.costPence} onChange={set('costPence')} className={field} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? L('Adding…', 'Додавання…') : L('Add item', 'Додати')}</button>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-stone)]">{L('Cancel', 'Скасувати')}</button>
        {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
      </div>
    </section>
  );
}
