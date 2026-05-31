'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function post(payload: object) {
  const res = await fetch('/api/admin/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.ok !== false, json };
}

const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';

export function ProfileEditor({ name: initialName, title: initialTitle, uk }: { name: string | null; title: string | null; uk: boolean }) {
  const router = useRouter();
  const L = (en: string, ukt: string) => (uk ? ukt : en);

  const [name, setName] = useState(initialName || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [pMsg, setPMsg] = useState('');
  const [pBusy, setPBusy] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cMsg, setCMsg] = useState('');
  const [cBusy, setCBusy] = useState(false);

  async function saveProfile() {
    setPBusy(true); setPMsg('');
    const { ok } = await post({ op: 'updateProfile', name, title });
    setPBusy(false);
    setPMsg(ok ? L('Saved ✓', 'Збережено ✓') : L('Could not save.', 'Не вдалося зберегти.'));
    if (ok) router.refresh();
  }

  async function changePassword() {
    if (next !== confirm) { setCMsg(L('Passwords don’t match.', 'Паролі не збігаються.')); return; }
    setCBusy(true); setCMsg('');
    const { ok, json } = await post({ op: 'changePassword', current, next });
    setCBusy(false);
    if (ok) { setCMsg(L('Password changed ✓', 'Пароль змінено ✓')); setCurrent(''); setNext(''); setConfirm(''); }
    else setCMsg(json.error || L('Could not change password.', 'Не вдалося змінити пароль.'));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{L('Details', 'Дані')}</h2>
        <div className="space-y-4">
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('Name', 'Імʼя')}
            <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('Title', 'Посада')}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L('e.g. Aesthetic Doctor', 'напр. Лікар-естетист')} className={`${field} mt-1`} />
          </label>
          <div className="flex items-center gap-3">
            <button onClick={saveProfile} disabled={pBusy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">{pBusy ? L('Saving…', 'Збереження…') : L('Save', 'Зберегти')}</button>
            {pMsg && <span className="text-sm text-[var(--color-stone)]">{pMsg}</span>}
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{L('Change password', 'Змінити пароль')}</h2>
        <div className="space-y-4">
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('Current password', 'Поточний пароль')}
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('New password', 'Новий пароль')}
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{L('Confirm new password', 'Підтвердьте новий пароль')}
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${field} mt-1`} />
          </label>
          <div className="flex items-center gap-3">
            <button onClick={changePassword} disabled={cBusy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{cBusy ? L('Saving…', 'Збереження…') : L('Change password', 'Змінити пароль')}</button>
            {cMsg && <span className="text-sm text-[var(--color-stone)]">{cMsg}</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
