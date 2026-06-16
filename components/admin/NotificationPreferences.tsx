'use client';

import { useEffect, useState } from 'react';

type Cat = { key: string; label: string; defaults: { inApp: boolean; email: boolean } };
type Prefs = {
  inApp?: Record<string, boolean>; email?: Record<string, boolean>;
  quietHours?: { start: string; end: string } | null; digest?: string; chatSound?: boolean;
};

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="grid h-5 w-5 place-items-center rounded border border-[var(--color-line)] bg-white text-transparent peer-checked:border-[var(--color-gold)] peer-checked:bg-[var(--color-gold)] peer-checked:text-white">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
    </label>
  );
}

export function NotificationPreferences() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/notifications/prefs')
      .then((r) => r.json())
      .then((j) => { if (j?.ok) { setCats(j.categories || []); setPrefs(j.prefs || {}); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const def = (k: string) => cats.find((c) => c.key === k)?.defaults;
  const inApp = (k: string) => prefs.inApp?.[k] ?? def(k)?.inApp ?? true;
  const email = (k: string) => prefs.email?.[k] ?? def(k)?.email ?? false;
  const setCh = (kind: 'inApp' | 'email', k: string, v: boolean) => setPrefs((p) => ({ ...p, [kind]: { ...(p[kind] || {}), [k]: v } }));

  async function save() {
    setSaving(true); setSaved(false);
    const body = {
      inApp: Object.fromEntries(cats.map((c) => [c.key, inApp(c.key)])),
      email: Object.fromEntries(cats.map((c) => [c.key, email(c.key)])),
      quietHours: prefs.quietHours?.start && prefs.quietHours?.end ? prefs.quietHours : null,
      digest: prefs.digest || 'weekly',
      chatSound: prefs.chatSound ?? false,
    };
    const j = await fetch('/api/admin/notifications/prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (j?.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  if (loading) return <p className="mt-6 text-sm text-[var(--color-stone)]">Loading…</p>;

  const card = 'rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]';

  return (
    <div className="mt-8 max-w-2xl space-y-8">
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">By category</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">In-app shows in the bell. Email sends a copy (off by default). Urgent alerts always show in-app whatever you choose here.</p>
        <div className={`mt-3 overflow-hidden ${card}`}>
          <div className="grid grid-cols-[1fr_4rem_4rem] items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-bone)] px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-wide text-[var(--color-stone)]">
            <span>Category</span><span className="text-center">In-app</span><span className="text-center">Email</span>
          </div>
          {cats.map((c) => (
            <div key={c.key} className="grid grid-cols-[1fr_4rem_4rem] items-center gap-2 border-b border-[var(--color-line)] px-4 py-2.5 last:border-0">
              <span className="text-sm text-[var(--color-ink)]">{c.label}</span>
              <span className="flex justify-center"><Check checked={inApp(c.key)} onChange={(v) => setCh('inApp', c.key, v)} label={`${c.label} in-app`} /></span>
              <span className="flex justify-center"><Check checked={email(c.key)} onChange={(v) => setCh('email', c.key, v)} label={`${c.label} email`} /></span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-[family-name:var(--font-display)] text-lg">Quiet hours</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">During these hours, non-urgent email/push is held for your digest. In-app still appears. Urgent always comes through.</p>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <input type="time" value={prefs.quietHours?.start || ''} onChange={(e) => setPrefs((p) => ({ ...p, quietHours: { start: e.target.value, end: p.quietHours?.end || '08:00' } }))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5" />
          <span className="text-[var(--color-stone)]">to</span>
          <input type="time" value={prefs.quietHours?.end || ''} onChange={(e) => setPrefs((p) => ({ ...p, quietHours: { start: p.quietHours?.start || '20:00', end: e.target.value } }))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5" />
          {prefs.quietHours && <button onClick={() => setPrefs((p) => ({ ...p, quietHours: null }))} className="ml-2 text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)]">Clear</button>}
        </div>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="font-[family-name:var(--font-display)] text-lg">Digest & sound</h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-[var(--color-stone)]">Summary digest</span>
            <select value={prefs.digest || 'weekly'} onChange={(e) => setPrefs((p) => ({ ...p, digest: e.target.value }))} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5">
              <option value="off">Off</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <Check checked={prefs.chatSound ?? false} onChange={(v) => setPrefs((p) => ({ ...p, chatSound: v }))} label="Chat sound" />
            <span className="text-[var(--color-stone)]">Play a sound for new chat messages</span>
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{saving ? 'Saving…' : 'Save preferences'}</button>
        {saved && <span className="text-sm text-[var(--color-jade)]">Saved</span>}
      </div>
    </div>
  );
}
