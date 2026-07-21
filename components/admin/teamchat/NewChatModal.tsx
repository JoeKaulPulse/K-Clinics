'use client';

import { useMemo, useState } from 'react';
import { Avatar } from './Avatar';
import { useTeamChat } from './TeamChatProvider';

// Start a 1:1 or create a group. Uses the shared roster from context.
export function NewChatModal({ onClose }: { onClose: () => void }) {
  const { roster, meId, startDm, createGroup } = useTeamChat();
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const people = useMemo(() => roster.filter((r) => r.id !== meId && r.name.toLowerCase().includes(q.toLowerCase())), [roster, meId, q]);

  async function go() {
    setBusy(true);
    try {
      if (mode === 'dm') { if (picked[0]) { await startDm(picked[0]); onClose(); } }
      else { if (picked.length) { await createGroup(name || 'New group', picked); onClose(); } }
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(42,36,32,0.5)] p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="New conversation" className="w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-5 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl">New conversation</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-stone)]">✕</button>
        </div>

        <div className="mb-3 inline-flex rounded-full border border-[var(--color-line)] p-0.5 text-sm">
          {(['dm', 'group'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setPicked([]); }} className={`rounded-full px-4 py-1 ${mode === m ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)]'}`}>
              {m === 'dm' ? 'Direct message' : 'Group'}
            </button>
          ))}
        </div>

        {mode === 'group' && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name (e.g. Front desk)" className="mb-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="mb-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />

        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {people.length === 0 && <p className="py-6 text-center text-sm text-[var(--color-stone)]">No one found.</p>}
          {people.map((r) => {
            const on = picked.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => setPicked((p) => mode === 'dm' ? [r.id] : (on ? p.filter((x) => x !== r.id) : [...p, r.id]))}
                className={`flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm ${on ? 'bg-[var(--color-gold)]/15' : 'hover:bg-[var(--color-bone)]'}`}
              >
                <Avatar name={r.name} photo={r.photoUrl} size={30} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[var(--color-ink)]">{r.name}</span>{r.title && <span className="block truncate text-xs text-[var(--color-stone)]">{r.title}</span>}</span>
                {mode === 'group' && <span className={`grid h-5 w-5 place-items-center rounded-full border ${on ? 'border-[var(--color-gold)] bg-[var(--color-gold-deep)] text-white' : 'border-[var(--color-line)]'}`}>{on ? '✓' : ''}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
          <button onClick={() => void go()} disabled={busy || picked.length === 0 || (mode === 'group' && picked.length < 1)} className="rounded-full bg-[var(--color-gold-deep)] px-6 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-40">
            {mode === 'dm' ? 'Start chat' : `Create group${picked.length ? ` (${picked.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
