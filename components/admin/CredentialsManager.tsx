'use client';

import { useState } from 'react';

type Secret = {
  name: string; label: string; group: string; help?: string; envOnly?: boolean;
  source: 'app' | 'env' | 'unset'; updatedBy?: string | null; updatedAt?: string | null;
};

const BADGE: Record<string, { text: string; cls: string }> = {
  app: { text: 'Set in app', cls: 'bg-green-100 text-green-800' },
  env: { text: 'From hosting', cls: 'bg-amber-100 text-amber-800' },
  unset: { text: 'Not set', cls: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
};

// BLD: owner-managed credentials. Enter API keys here instead of hosting env
// vars; values are encrypted server-side and never sent back to the browser.
export function CredentialsManager({ initial }: { initial: Secret[] }) {
  const [secrets, setSecrets] = useState(initial);
  const groups = Array.from(new Set(secrets.map((s) => s.group)));

  return (
    <div className="mt-6 space-y-8">
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-stone)]">{g}</h2>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
            {secrets.filter((s) => s.group === g).map((s, i) => (
              <Row key={s.name} s={s} first={i === 0} onChange={(next) => setSecrets((prev) => prev.map((x) => (x.name === s.name ? next : x)))} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Row({ s, first, onChange }: { s: Secret; first: boolean; onChange: (s: Secret) => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!value.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/secrets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: s.name, value }) });
      const j = await r.json();
      if (j.ok) { setValue(''); setMsg('Saved'); onChange({ ...s, source: 'app', updatedAt: new Date().toISOString() }); }
      else setMsg(j.error || 'Could not save.');
    } catch { setMsg('Network error.'); } finally { setBusy(false); }
  }

  async function clear() {
    if (!confirm(`Remove the in-app value for ${s.name}? It will fall back to the hosting env var if one is set.`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/secrets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: s.name }) });
      const j = await r.json();
      if (j.ok) { setMsg('Cleared — reload to see the hosting-env fallback, if any.'); onChange({ ...s, source: 'unset', updatedAt: null }); }
      else setMsg(j.error || 'Could not clear.');
    } catch { setMsg('Network error.'); } finally { setBusy(false); }
  }

  const badge = BADGE[s.source];
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-4 ${first ? '' : 'border-t border-[var(--color-line)]'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-ink)]">{s.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${badge.cls}`}>{badge.text}</span>
        </div>
        <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[0.7rem] text-[var(--color-stone)]">{s.name}{s.help ? ` · ${s.help}` : ''}</p>
      </div>

      {s.envOnly ? (
        <span className="text-xs text-[var(--color-stone)]">Managed in hosting</span>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="password" value={value} onChange={(e) => setValue(e.target.value)}
            placeholder={s.source === 'app' ? 'Enter to replace' : 'Paste value'} autoComplete="off"
            className="w-48 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm focus:border-[var(--color-gold)] focus:outline-none"
          />
          <button type="button" onClick={save} disabled={busy || !value.trim()}
            className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-40">
            {busy ? '…' : 'Save'}
          </button>
          {s.source === 'app' && (
            <button type="button" onClick={clear} disabled={busy} title="Remove the in-app value"
              className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-stone)] hover:bg-[var(--color-bone)] disabled:opacity-40">Clear</button>
          )}
          {msg && <span className="text-xs text-[var(--color-stone)]">{msg}</span>}
        </div>
      )}
    </div>
  );
}
