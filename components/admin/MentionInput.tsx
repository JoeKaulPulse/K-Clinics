'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Reusable @-mention input for admin comment surfaces (build board, and any
// future consultation/client notes). Shows a live picker of team members (and
// Claude) when you type "@". Staff-only: the picker only appears for users the
// server marks as able to mention (admins + clinicians); for everyone else it
// degrades to a plain field. Inserts a stable @handle (email local-part, or
// "claude") which the server resolves and notifies.

export type Mentionable = { handle: string; name: string; email: string | null; role: string; isClinician: boolean };

let cache: { people: Mentionable[]; canMention: boolean } | null = null;
let inflight: Promise<{ people: Mentionable[]; canMention: boolean }> | null = null;
async function loadMentionables() {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/api/admin/mentionables')
      .then((r) => r.json())
      .then((j) => ({ people: (j?.people || []) as Mentionable[], canMention: !!j?.canMention }))
      .catch(() => ({ people: [], canMention: false }));
  }
  cache = await inflight;
  return cache;
}

export function MentionInput({
  value, onChange, onSubmit, placeholder, multiline = false, className = '', autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [people, setPeople] = useState<Mentionable[]>([]);
  const [canMention, setCanMention] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => { let on = true; loadMentionables().then((m) => { if (on) { setPeople(m.people); setCanMention(m.canMention); } }); return () => { on = false; }; }, []);

  // The @-token immediately before the caret, if any (lets us drive the picker).
  function activeQuery(el: HTMLTextAreaElement | HTMLInputElement): string | null {
    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos);
    const m = before.match(/(?:^|\s)@([\w.+-]*)$/);
    return m ? m[1] : null;
  }

  const matches = useMemo(() => {
    if (!open) return [];
    const q = query.toLowerCase();
    return people
      .filter((p) => !q || p.handle.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [open, query, people]);

  function refresh(el: HTMLTextAreaElement | HTMLInputElement) {
    if (!canMention) return;
    const q = activeQuery(el);
    if (q === null) { setOpen(false); return; }
    setQuery(q); setActive(0); setOpen(true);
  }

  function pick(p: Mentionable) {
    const el = ref.current; if (!el) return;
    const pos = el.selectionStart ?? value.length;
    const before = value.slice(0, pos).replace(/@([\w.+-]*)$/, `@${p.handle} `);
    const next = before + value.slice(pos);
    onChange(next);
    setOpen(false);
    // Restore caret just after the inserted handle.
    requestAnimationFrame(() => { const c = before.length; el.focus(); try { el.setSelectionRange(c, c); } catch { /* input types vary */ } });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (open && matches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[active]); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !multiline && onSubmit) { e.preventDefault(); onSubmit(); }
  }

  const shared = {
    ref: ref as React.Ref<never>,
    value,
    placeholder: placeholder || (canMention ? 'Add a note… (@ to mention)' : 'Add a note…'),
    autoFocus,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => { onChange(e.target.value); refresh(e.target); },
    onKeyDown,
    onClick: (e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>) => refresh(e.currentTarget),
    onBlur: () => setTimeout(() => setOpen(false), 150), // allow click on a suggestion
    className,
  };

  return (
    <div className="relative min-w-0 flex-1">
      {multiline ? <textarea rows={3} {...shared} /> : <input {...shared} />}
      {open && matches.length > 0 && (
        <ul className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-lift)]">
          {matches.map((p, i) => (
            <li key={p.handle}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === active ? 'bg-[var(--color-bone)]' : ''}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-[var(--color-gold-soft)]">{p.handle === 'claude' ? '◆' : (p.name[0] || '?').toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[var(--color-ink)]">{p.name}{p.isClinician ? ' · clinician' : ''}</span>
                  <span className="block truncate text-xs text-[var(--color-stone-soft)]">@{p.handle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
