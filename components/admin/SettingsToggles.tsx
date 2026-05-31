'use client';

import { useState } from 'react';

type Meta = { key: string; label: string; description: string; value: boolean };

export function SettingsToggles({ initial, canManage }: { initial: Meta[]; canManage: boolean }) {
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(key: string, next: boolean) {
    setState((s) => s.map((m) => (m.key === key ? { ...m, value: next } : m)));
    setSaving(key);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: next }),
      });
      if (!res.ok) setState((s) => s.map((m) => (m.key === key ? { ...m, value: !next } : m))); // revert
    } catch {
      setState((s) => s.map((m) => (m.key === key ? { ...m, value: !next } : m)));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="divide-y divide-[var(--color-line)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      {state.map((m) => (
        <div key={m.key} className="flex items-start justify-between gap-6 p-5">
          <div className="max-w-xl">
            <p className="font-medium">{m.label}</p>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{m.description}</p>
          </div>
          <button
            role="switch"
            aria-checked={m.value}
            aria-label={m.label}
            disabled={!canManage || saving === m.key}
            onClick={() => toggle(m.key, !m.value)}
            className={`mt-1 grid h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors disabled:opacity-50 ${m.value ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-sand)]'}`}
          >
            <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${m.value ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
