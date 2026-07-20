'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Avatar, AvatarStack } from './Avatar';
import { ChatWindow } from './ChatWindow';
import { NewChatModal } from './NewChatModal';
import { useTeamChat } from './TeamChatProvider';
import { shortWhen } from './util';

// Full-page two-pane messages view — used for deep links from notifications and
// as the mobile experience (the docked windows are desktop-only).
export function MessagesPage() {
  const { channels, meId, markRead, ready } = useTeamChat();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Honour ?c=<channelId> once, then fall back to the most recent conversation.
  useEffect(() => {
    const c = params.get('c');
    if (c) { setSelected(c); markRead(c); }
  }, [params, markRead]);
  useEffect(() => {
    if (!selected && channels.length) setSelected(channels[0].id);
  }, [channels, selected]);

  function open(id: string) { setSelected(id); markRead(id); }

  return (
    <div className="flex h-[calc(100vh-9rem)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-lift)]">
      {/* List pane */}
      <aside className={`${selected ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-[var(--color-line)] md:w-80`}>
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <h1 className="font-[family-name:var(--font-display)] text-xl">Team chat</h1>
          <button onClick={() => setShowNew(true)} className="rounded-full bg-[var(--color-gold-deep)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-ink)]">New</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {ready && channels.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[var(--color-stone)]">
              <p>No conversations yet.</p>
              <button onClick={() => setShowNew(true)} className="mt-2 text-[var(--color-gold-deep)] underline">Start one →</button>
            </div>
          )}
          {channels.map((c) => (
            <button key={c.id} onClick={() => open(c.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bone)] ${selected === c.id ? 'bg-[var(--color-bone)]' : ''}`}>
              {c.kind === 'GROUP' ? <AvatarStack members={c.members} meId={meId} size={40} /> : <Avatar name={c.title} photo={c.members.find((m) => m.id !== meId)?.photoUrl} size={40} />}
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
      </aside>

      {/* Thread pane */}
      <section className={`${selected ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {selected ? (
          <>
            <button onClick={() => setSelected(null)} className="border-b border-[var(--color-line)] px-4 py-2 text-left text-sm text-[var(--color-gold-deep)] md:hidden">← All conversations</button>
            <div className="min-h-0 flex-1"><ChatWindow channelId={selected} variant="embedded" /></div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-[var(--color-stone)]">Select a conversation to start chatting.</div>
        )}
      </section>

      {showNew && <NewChatModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
