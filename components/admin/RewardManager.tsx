'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CatalogueReward } from '@/components/admin/RewardsCatalogue';

export type PendingRedemption = { id: string; staffName: string; rewardName: string; costPoints: number; createdAt: string };

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

export function RewardManager({
  rewards,
  pending,
  uk = false,
}: {
  rewards: (CatalogueReward & { active: boolean })[];
  pending: PendingRedemption[];
  uk?: boolean;
}) {
  const L = (en: string, ukt: string) => (uk ? ukt : en);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', costPoints: '', emoji: '', stock: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function startNew() { setEditing(null); setForm({ name: '', description: '', costPoints: '', emoji: '', stock: '' }); setOpen(true); setMsg(''); }
  function startEdit(r: CatalogueReward) {
    setEditing(r.id);
    setForm({ name: r.name, description: r.description || '', costPoints: String(r.costPoints), emoji: r.emoji || '', stock: r.stock == null ? '' : String(r.stock) });
    setOpen(true); setMsg('');
  }

  async function save() {
    if (!form.name.trim() || !Number(form.costPoints)) { setMsg(L('Name and a positive cost are required.', 'Потрібні назва та додатна вартість.')); return; }
    setBusy(true); setMsg('');
    const res = await fetch('/api/admin/rewards/catalogue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editing || undefined, ...form, costPoints: Number(form.costPoints) }),
    });
    setBusy(false);
    if (res.ok) { setOpen(false); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); setMsg(j.error || L('Could not save.', 'Не вдалося зберегти.')); }
  }

  async function catalogueAction(body: object) {
    await fetch('/api/admin/rewards/catalogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    router.refresh();
  }

  async function decide(redemptionId: string, decision: 'FULFILLED' | 'DECLINED') {
    await fetch('/api/admin/rewards/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decide', redemptionId, decision }) });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Pending redemptions queue */}
      {pending.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">{L('Pending redemptions', 'Очікують обміну')} <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs text-amber-950">{pending.length}</span></h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm">
                <span><span className="font-medium">{p.staffName}</span> — {p.rewardName} <span className="text-[var(--color-stone)]">({p.costPoints} {L('pts', 'балів')})</span></span>
                <span className="flex gap-2">
                  <button onClick={() => decide(p.id, 'FULFILLED')} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700">{L('Fulfil', 'Виконати')}</button>
                  <button onClick={() => decide(p.id, 'DECLINED')} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-stone)] hover:border-rose-300 hover:text-rose-600">{L('Decline & refund', 'Відхилити та повернути')}</button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Catalogue management */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg">{L('Manage catalogue', 'Керування каталогом')}</h2>
          {!open && <button onClick={startNew} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">+ {L('New reward', 'Нова винагорода')}</button>}
        </div>

        {open && (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[var(--color-stone)]">{L('Name', 'Назва')}
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder={L('e.g. Extra day off', 'напр. Додатковий вихідний')} />
              </label>
              <label className="text-xs text-[var(--color-stone)]">{L('Emoji', 'Емодзі')}
                <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className={field} placeholder="🏖️" />
              </label>
              <label className="text-xs text-[var(--color-stone)] sm:col-span-2">{L('Description', 'Опис')}
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
              </label>
              <label className="text-xs text-[var(--color-stone)]">{L('Cost (points)', 'Вартість (балів)')}
                <input type="number" value={form.costPoints} onChange={(e) => setForm({ ...form, costPoints: e.target.value })} className={field} />
              </label>
              <label className="text-xs text-[var(--color-stone)]">{L('Stock (blank = unlimited)', 'Запас (порожньо = без обмежень)')}
                <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={field} />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{busy ? L('Saving…', 'Збереження…') : L('Save', 'Зберегти')}</button>
              <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-stone)]">{L('Cancel', 'Скасувати')}</button>
              {msg && <span className="text-sm text-rose-600">{msg}</span>}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {rewards.length === 0 && <p className="text-sm text-[var(--color-stone)]">{L('No rewards yet — add the first one.', 'Поки немає винагород — додайте першу.')}</p>}
          {rewards.map((r) => (
            <div key={r.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-4 py-2.5 text-sm ${r.active ? 'bg-white' : 'bg-[var(--color-bone)] opacity-70'}`}>
              <span className="flex items-center gap-2">
                <span aria-hidden>{r.emoji || '🎁'}</span>
                <span className="font-medium">{r.name}</span>
                <span className="text-[var(--color-stone)]">· {r.costPoints} {L('pts', 'балів')}</span>
                {r.stock != null && <span className="text-[var(--color-stone)]">· {r.stock} {L('in stock', 'в наявності')}</span>}
              </span>
              <span className="flex items-center gap-2">
                <button onClick={() => catalogueAction({ action: 'toggle', id: r.id, active: !r.active })} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">{r.active ? L('Hide', 'Сховати') : L('Show', 'Показати')}</button>
                <button onClick={() => startEdit(r)} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">{L('Edit', 'Редагувати')}</button>
                <button onClick={() => { if (confirm(L('Delete this reward?', 'Видалити цю винагороду?'))) catalogueAction({ action: 'delete', id: r.id }); }} className="text-xs text-rose-500 hover:text-rose-700">{L('Delete', 'Видалити')}</button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
