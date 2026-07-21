'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Avatar, AvatarStack } from './Avatar';
import { NewChatModal } from './NewChatModal';
import { useTeamChat } from './TeamChatProvider';
import { shortWhen } from './util';

// Top-bar entry point, sitting beside the notification bell so chat lives in the
// same "hub" — but conversations open as docked windows (desktop) or the full
// /admin/messages page (mobile), per the brief.
export function ChatLauncher() {
  const { channels, totalUnread, openChannel, meId } = useTeamChat();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  function pick(id: string) {
    setOpen(false);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) router.push(`/admin/messages?c=${id}`);
    else openChannel(id);
  }

  const list = channels.filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase()) || c.lastMessagePreview.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Team chat" aria-haspopup="menu" aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bone)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]"
        title="Team chat"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 4h12a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0116 14H8l-4 3v-3a1.5 1.5 0 01-1.5-1.5v-7A1.5 1.5 0 014 4z" />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[0.6rem] font-semibold text-amber-950">{totalUnread > 99 ? '99+' : totalUnread}</span>
        )}
      </button>

      {open && (
        <div role="menu" className="kc-pop absolute right-0 z-40 mt-2 flex max-h-[70vh] w-[22rem] flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
            <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">Messages</h3>
            <button onClick={() => { setShowNew(true); setOpen(false); }} className="rounded-full bg-[var(--color-gold-deep)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-ink)]">New</button>
          </div>
          <div className="border-b border-[var(--color-line)] px-3 py-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-[var(--color-stone)]">
                <p>No conversations yet.</p>
                <button onClick={() => { setShowNew(true); setOpen(false); }} className="mt-2 text-[var(--color-gold-deep)] underline">Start one →</button>
              </div>
            )}
            {list.map((c) => (
              <button key={c.id} onClick={() => pick(c.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bone)]">
                {c.kind === 'GROUP' ? <AvatarStack members={c.members} meId={meId} size={36} /> : <Avatar name={c.title} photo={c.members.find((m) => m.id !== meId)?.photoUrl} size={36} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread > 0 ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-ink-soft)]'}`}>{c.title}</span>
                    <span className="shrink-0 text-[0.65rem] text-[var(--color-stone)]">{shortWhen(c.lastMessageAt)}</span>
                  </div>
                  <p className={`truncate text-xs ${c.unread > 0 ? 'text-[var(--color-ink-soft)]' : 'text-[var(--color-stone)]'}`}>{c.muted ? '🔕 ' : ''}{c.lastMessagePreview || 'No messages yet'}</p>
                </div>
                {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[var(--color-gold-deep)] px-1 text-[0.65rem] font-semibold text-white">{c.unread}</span>}
              </button>
            ))}
          </div>
          <Link href="/admin/messages" className="border-t border-[var(--color-line)] px-4 py-2.5 text-center text-xs text-[var(--color-gold-deep)] hover:bg-[var(--color-bone)]">Open messages page →</Link>
        </div>
      )}

      {showNew && <NewChatModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
