'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ConnectionCentre as Centre, ConnectionView, ConnectionKey } from '@/lib/connection-centre';

const LIGHT: Record<string, { dot: string; label: string; text: string }> = {
  green: { dot: '#2f7152', label: 'Connected', text: 'text-[#2f7152]' },
  amber: { dot: '#bd8b3c', label: 'Needs a step', text: 'text-[#9a6b1f]' },
  red: { dot: '#c0392b', label: 'Not working', text: 'text-[#c0392b]' },
  grey: { dot: '#b7a294', label: 'Not checked', text: 'text-[var(--color-stone)]' },
};
const SRC: Record<string, { text: string; cls: string }> = {
  app: { text: 'Set in app', cls: 'bg-green-100 text-green-800' },
  env: { text: 'From hosting', cls: 'bg-amber-100 text-amber-800' },
  unset: { text: 'Not set', cls: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
};

export function ConnectionCentre({ initial }: { initial: Centre }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const categories = Array.from(new Set(initial.connections.map((c) => c.category)));

  async function recheck() {
    setBusy(true);
    try { await fetch('/api/admin/api-health', { cache: 'no-store' }); router.refresh(); }
    catch { /* ignore */ } finally { setBusy(false); }
  }

  const ov = LIGHT[initial.overall];
  return (
    <div className="mt-6">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: ov.dot }} />
          <span className={`font-medium ${ov.text}`}>{ov.label}</span>
          <span className="text-sm text-[var(--color-stone)]">
            {initial.counts.green} connected · {initial.counts.amber} need a step · {initial.counts.red} broken · {initial.counts.grey} unchecked
          </span>
        </div>
        <div className="flex items-center gap-3">
          {initial.generatedAt && <span className="text-xs text-[var(--color-stone)]">Checked {new Date(initial.generatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
          <button onClick={recheck} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50">
            {busy ? 'Checking…' : 'Re-check now'}
          </button>
        </div>
      </div>

      {categories.map((cat) => (
        <section key={cat} className="mt-7">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-stone)]">{cat}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {initial.connections.filter((c) => c.category === cat).map((c) => <Card key={c.id} c={c} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function Card({ c }: { c: ConnectionView }) {
  const l = LIGHT[c.light];
  return (
    <div className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.dot }} />
            <h3 className="font-[family-name:var(--font-display)] text-lg leading-tight">{c.title}</h3>
          </div>
          <p className={`mt-1 text-sm font-medium ${l.text}`}>{c.detail}</p>
        </div>
        {c.console && <a href={c.console.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-[var(--color-gold-deep)] hover:underline">{c.console.label} ↗</a>}
      </div>

      <p className="mt-2 text-sm text-[var(--color-stone)]">{c.powers}</p>
      {c.info && c.info.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-xs text-[var(--color-stone)]">{c.info.map((i, n) => <li key={n}>{i}</li>)}</ul>
      )}

      {c.keys.length > 0 && (
        <div className="mt-4 space-y-2">
          {c.keys.map((k) => <KeyRow key={k.name} k={k} />)}
        </div>
      )}

      {c.register && c.register.length > 0 && (
        <div className="mt-4 space-y-2">
          {c.register.map((u) => <CopyRow key={u.url} label={u.label} value={u.url} note={u.note} />)}
        </div>
      )}

      {(c.connectHref || c.steps) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {c.connectHref && (
            <a href={c.connectHref} className="rounded-full bg-[var(--color-gold-deep)] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
              {c.connectLabel || 'Connect'}
            </a>
          )}
        </div>
      )}

      {c.steps && c.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-[var(--color-stone)]">{c.steps.map((s, n) => <li key={n}>{s}</li>)}</ol>
      )}
    </div>
  );
}

function KeyRow({ k }: { k: ConnectionKey }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [source, setSource] = useState(k.source);
  const badge = SRC[source];

  async function save() {
    if (!value.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/secrets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: k.name, value }) });
      const j = await r.json();
      if (j.ok) { setValue(''); setMsg('Saved'); setSource('app'); } else setMsg(j.error || 'Could not save.');
    } catch { setMsg('Network error.'); } finally { setBusy(false); }
  }
  async function clear() {
    if (!confirm(`Remove the in-app value for ${k.name}?`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/secrets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: k.name }) });
      const j = await r.json();
      if (j.ok) { setMsg('Cleared'); setSource('unset'); } else setMsg(j.error || 'Could not clear.');
    } catch { setMsg('Network error.'); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--color-ink)]">{k.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${badge.cls}`}>{badge.text}</span>
      </div>
      {k.help && <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[0.65rem] text-[var(--color-stone)]">{k.help}</p>}
      {k.envOnly ? (
        <p className="mt-2 text-xs text-[var(--color-stone)]">Set in hosting (build-time key — cannot be entered here).</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off"
            placeholder={source === 'app' ? 'Enter to replace' : 'Paste value'}
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm focus:border-[var(--color-gold)] focus:outline-none" />
          <button onClick={save} disabled={busy || !value.trim()} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[var(--color-porcelain)] hover:opacity-90 disabled:opacity-40">{busy ? '…' : 'Save'}</button>
          {source === 'app' && <button onClick={clear} disabled={busy} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-stone)] hover:bg-[var(--color-bone)] disabled:opacity-40">Clear</button>}
          {msg && <span className="text-xs text-[var(--color-stone)]">{msg}</span>}
        </div>
      )}
    </div>
  );
}

function CopyRow({ label, value, note }: { label: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-sand)] bg-[var(--color-porcelain)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-ink)]">{label}</span>
        <button onClick={copy} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-stone)] hover:bg-[var(--color-bone)]">{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <p className="mt-1 break-all font-[family-name:var(--font-mono)] text-[0.65rem] text-[var(--color-stone)]">{value}</p>
      {note && <p className="mt-1 text-[0.65rem] text-[var(--color-stone)]">{note}</p>}
    </div>
  );
}
