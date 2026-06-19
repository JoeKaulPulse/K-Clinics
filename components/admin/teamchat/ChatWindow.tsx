'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarStack } from './Avatar';
import { Composer } from './Composer';
import { EmojiPicker } from './Pickers';
import { useTeamChat } from './TeamChatProvider';
import { clock, dayLabel, tokenizeBody, QUICK_REACTIONS } from './util';
import type { ChatMessage } from './types';

async function api(body: Record<string, unknown>) {
  return fetch('/api/admin/team-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false }));
}

export function ChatWindow({ channelId, variant = 'docked', onRequestClose }: { channelId: string; variant?: 'docked' | 'embedded'; onRequestClose?: () => void }) {
  const { channelById, meId, closeWindow, toggleMinimize, markRead, tick, refreshChannels, roster } = useTeamChat();
  const channel = channelById(channelId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menu, setMenu] = useState(false);
  const [manage, setManage] = useState<null | 'members' | 'rename'>(null);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cursor = useRef<string | null>(null);

  // Initial load.
  useEffect(() => {
    let on = true;
    fetch(`/api/admin/team-chat?op=messages&channelId=${channelId}`).then((r) => r.json()).then((j) => {
      if (!on || !j?.ok) return;
      setMessages(j.messages);
      cursor.current = j.messages.length ? j.messages[j.messages.length - 1].createdAt : null;
      setHasMore(j.messages.length >= 40);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    });
    return () => { on = false; };
  }, [channelId]);

  // Live deltas: when the shared signal ticks, pull anything new since our cursor.
  useEffect(() => {
    if (!cursor.current) return;
    let on = true;
    fetch(`/api/admin/team-chat?op=messages&channelId=${channelId}&after=${encodeURIComponent(cursor.current)}`).then((r) => r.json()).then((j) => {
      if (!on || !j?.ok || !j.messages?.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m: ChatMessage) => m.id));
        const fresh = (j.messages as ChatMessage[]).filter((m) => !seen.has(m.id));
        if (!fresh.length) return prev;
        return [...prev, ...fresh];
      });
      cursor.current = j.messages[j.messages.length - 1].createdAt;
      const el = scrollRef.current;
      const near = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 160 : true;
      if (near) requestAnimationFrame(() => el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
      markRead(channelId);
    });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  async function loadEarlier() {
    const first = messages[0];
    if (!first) return;
    const j = await fetch(`/api/admin/team-chat?op=messages&channelId=${channelId}&before=${encodeURIComponent(first.createdAt)}`).then((r) => r.json());
    if (j?.ok) {
      const el = scrollRef.current; const prevH = el?.scrollHeight || 0;
      setMessages((prev) => [...j.messages.filter((m: ChatMessage) => !prev.some((p) => p.id === m.id)), ...prev]);
      setHasMore(j.messages.length >= 40);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH; });
    }
  }

  function onSent(m: ChatMessage) {
    setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
    cursor.current = m.createdAt;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
  }

  async function react(messageId: string, emoji: string) {
    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m;
      const ex = m.reactions.find((r) => r.emoji === emoji);
      let reactions;
      if (ex) reactions = ex.mine ? (ex.count <= 1 ? m.reactions.filter((r) => r.emoji !== emoji) : m.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)) : m.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r);
      else reactions = [...m.reactions, { emoji, count: 1, mine: true }];
      return { ...m, reactions };
    }));
    await api({ op: 'react', messageId, emoji });
  }
  async function remove(messageId: string) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, body: '', deletedAt: new Date().toISOString(), attachments: [] } : m)));
    await api({ op: 'delete', messageId });
  }
  // Link to the team Tasks board: turn a message into a task (TSK-).
  async function createTask(m: ChatMessage): Promise<string | null> {
    const title = (m.body || `Follow up — ${m.authorName}`).replace(/\s+/g, ' ').trim().slice(0, 180);
    const r = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'create', title, detail: `From team chat · ${channel?.title || ''}` }) }).then((x) => x.json()).catch(() => ({ ok: false }));
    return r?.ok ? (r.ref || 'task') : null;
  }

  if (!channel) return null;
  const docked = variant === 'docked';
  const shell = docked
    ? 'flex h-[27rem] w-[20.5rem] flex-col overflow-hidden rounded-t-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-lift)]'
    : 'flex h-full w-full flex-col overflow-hidden bg-[var(--color-porcelain)]';

  return (
    <div className={shell}>
      {/* Header */}
      <div className="relative flex items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-[var(--color-porcelain)]">
        {channel.kind === 'GROUP' ? <AvatarStack members={channel.members} meId={meId} size={28} /> : <Avatar name={channel.title} photo={channel.members.find((m) => m.id !== meId)?.photoUrl} size={28} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{channel.title}</p>
          <p className="truncate text-[0.65rem] text-[var(--color-gold-bright)]">{channel.kind === 'GROUP' ? `${channel.memberCount} members${channel.muted ? ' · muted' : ''}` : (channel.members.find((m) => m.id !== meId)?.title || 'Direct message')}</p>
        </div>
        <button onClick={() => setMenu((v) => !v)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10" aria-label="Conversation options">⋯</button>
        {docked && <button onClick={() => toggleMinimize(channelId)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10" aria-label="Minimize">—</button>}
        <button onClick={() => (onRequestClose ? onRequestClose() : closeWindow(channelId))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10" aria-label="Close">✕</button>
        {menu && (
          <div className="absolute right-2 top-11 z-[60] w-44 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white text-[var(--color-ink)] shadow-[var(--shadow-lift)]">
            <button onClick={() => { void api({ op: 'mute', channelId, muted: !channel.muted }).then(refreshChannels); setMenu(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bone)]">{channel.muted ? 'Unmute' : 'Mute'} notifications</button>
            {channel.kind === 'GROUP' && <button onClick={() => { setManage('members'); setMenu(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bone)]">Members & add people</button>}
            {channel.kind === 'GROUP' && channel.myRole === 'OWNER' && <button onClick={() => { setManage('rename'); setMenu(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-bone)]">Rename group</button>}
            {channel.kind === 'GROUP' && <button onClick={() => { if (confirm('Leave this group?')) void api({ op: 'leave', channelId }).then(() => { closeWindow(channelId); refreshChannels(); }); setMenu(false); }} className="block w-full px-3 py-2 text-left text-sm text-[#b23b3b] hover:bg-[var(--color-bone)]">Leave group</button>}
          </div>
        )}
      </div>

      {manage && <ManagePanel mode={manage} channelId={channelId} onDone={() => { setManage(null); void refreshChannels(); }} roster={roster} memberIds={channel.members.map((m) => m.id)} currentName={channel.title} />}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {hasMore && messages.length >= 40 && <button onClick={() => void loadEarlier()} className="mx-auto mb-2 block rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-stone)] hover:bg-[var(--color-bone)]">Load earlier</button>}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const grouped = prev && prev.authorId === m.authorId && m.kind !== 'SYSTEM' && prev.kind !== 'SYSTEM' && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000);
          return (
            <div key={m.id}>
              {newDay && <div className="my-2 text-center text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">{dayLabel(m.createdAt)}</div>}
              {m.kind === 'SYSTEM'
                ? <p className="py-0.5 text-center text-[0.7rem] italic text-[var(--color-stone)]">{m.body}</p>
                : <MessageRow m={m} grouped={Boolean(grouped)} members={channel.members} onReact={react} onReply={setReplyTo} onDelete={remove} onCreateTask={createTask} />}
            </div>
          );
        })}
      </div>

      <Composer channel={channel} meId={meId} onSent={onSent} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
    </div>
  );
}

function MessageRow({ m, grouped, members, onReact, onReply, onDelete, onCreateTask }: {
  m: ChatMessage; grouped: boolean; members: { id: string; name: string; photoUrl: string | null }[];
  onReact: (id: string, e: string) => void; onReply: (m: ChatMessage) => void; onDelete: (id: string) => void;
  onCreateTask: (m: ChatMessage) => Promise<string | null>;
}) {
  const [picker, setPicker] = useState(false);
  const [taskRef, setTaskRef] = useState<string | null>(null);
  const mine = m.mine;
  const parts = tokenizeBody(m.body, members.map((x) => ({ id: x.id, name: x.name })), m.mentionIds, m.mentionsAll);
  return (
    <div className={`group flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
      <div className="w-7 shrink-0">{!grouped && !mine && <Avatar name={m.authorName} photo={m.authorPhoto} size={28} />}</div>
      <div className={`relative min-w-0 max-w-[78%] ${mine ? 'items-end text-right' : ''}`}>
        {!grouped && !mine && <p className="mb-0.5 text-[0.7rem] font-medium text-[var(--color-stone)]">{m.authorName}</p>}
        {m.replyTo && <p className={`mb-0.5 truncate border-l-2 border-[var(--color-sand)] pl-1.5 text-[0.7rem] text-[var(--color-stone)] ${mine ? 'ml-auto text-left' : ''}`}>↩ {m.replyTo.authorName}: {m.replyTo.preview}</p>}
        {m.deletedAt ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-bone)]/60 px-3 py-1.5 text-sm italic text-[var(--color-stone)]">Message removed</p>
        ) : (
          <>
            {(m.body || parts.length > 0) && m.body && (
              <div className={`inline-block whitespace-pre-wrap break-words rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${mine ? 'bg-[var(--color-gold-deep)] text-white' : 'bg-white text-[var(--color-ink)]'}`}>
                {parts.map((p, i) => p.mention ? <span key={i} className={`rounded px-0.5 font-medium ${mine ? 'bg-white/20' : 'bg-[var(--color-gold)]/20 text-[var(--color-gold-deep)]'}`}>{p.text}</span> : <span key={i}>{p.text}</span>)}
              </div>
            )}
            {m.attachments.length > 0 && (
              <div className={`mt-1 flex flex-wrap gap-1.5 ${mine ? 'justify-end' : ''}`}>
                {m.attachments.map((a) => (
                  a.kind === 'VIDEO'
                    ? <video key={a.id} src={a.url} controls className="max-h-48 max-w-[12rem] rounded-[var(--radius-md)] border border-[var(--color-line)]" />
                    : a.kind === 'FILE'
                      ? <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-xs text-[var(--color-ink)] hover:border-[var(--color-gold)]">📄 <span className="max-w-[9rem] truncate">{a.name || 'File'}</span></a>
                      : <a key={a.id} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name || ''} className="max-h-48 max-w-[12rem] rounded-[var(--radius-md)] border border-[var(--color-line)] object-cover" /></a>
                ))}
              </div>
            )}
          </>
        )}
        {m.reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`}>
            {m.reactions.map((r) => (
              <button key={r.emoji} onClick={() => onReact(m.id, r.emoji)} className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[0.7rem] ${r.mine ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/15' : 'border-[var(--color-line)] bg-white'}`}>{r.emoji}<span className="text-[var(--color-stone)]">{r.count}</span></button>
            ))}
          </div>
        )}
        <p className="mt-0.5 text-[0.6rem] text-[var(--color-stone)] opacity-0 group-hover:opacity-100">{clock(m.createdAt)}{m.editedAt ? ' · edited' : ''}</p>
      </div>
      {/* Hover actions */}
      {!m.deletedAt && (
        <div className={`relative flex items-center self-center opacity-0 transition-opacity group-hover:opacity-100 ${mine ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-0.5">
            {QUICK_REACTIONS.slice(0, 3).map((e) => <button key={e} onClick={() => onReact(m.id, e)} className="grid h-6 w-6 place-items-center rounded-full text-sm hover:bg-[var(--color-bone)]">{e}</button>)}
            <button onClick={() => setPicker((v) => !v)} className="grid h-6 w-6 place-items-center rounded-full text-xs text-[var(--color-stone)] hover:bg-[var(--color-bone)]" aria-label="React">＋</button>
            <button onClick={() => onReply(m)} className="grid h-6 w-6 place-items-center rounded-full text-xs text-[var(--color-stone)] hover:bg-[var(--color-bone)]" aria-label="Reply">↩</button>
            <button onClick={async () => { const r = await onCreateTask(m); if (r) { setTaskRef(r); setTimeout(() => setTaskRef(null), 2600); } }} className="grid h-6 w-6 place-items-center rounded-full text-xs text-[var(--color-stone)] hover:bg-[var(--color-bone)]" aria-label="Create a task from this message" title="Create a task">✓</button>
            {mine && <button onClick={() => { if (confirm('Delete this message?')) onDelete(m.id); }} className="grid h-6 w-6 place-items-center rounded-full text-xs text-[var(--color-stone)] hover:bg-[var(--color-bone)]" aria-label="Delete">🗑</button>}
            {taskRef && <span className="whitespace-nowrap rounded-full bg-[var(--color-jade)]/15 px-2 py-0.5 text-[0.6rem] text-[var(--color-jade)]">Added {taskRef}</span>}
          </div>
          {picker && <EmojiPicker align={mine ? 'right' : 'left'} onPick={(e) => { onReact(m.id, e); setPicker(false); }} onClose={() => setPicker(false)} />}
        </div>
      )}
    </div>
  );
}

function ManagePanel({ mode, channelId, onDone, roster, memberIds, currentName }: {
  mode: 'members' | 'rename'; channelId: string; onDone: () => void;
  roster: { id: string; name: string; photoUrl: string | null }[]; memberIds: string[]; currentName: string;
}) {
  const [name, setName] = useState(currentName);
  const [picked, setPicked] = useState<string[]>([]);
  const candidates = roster.filter((r) => !memberIds.includes(r.id));
  return (
    <div className="border-b border-[var(--color-line)] bg-white px-3 py-2.5">
      {mode === 'rename' ? (
        <div className="flex items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]" />
          <button onClick={() => void api({ op: 'rename', channelId, name }).then(onDone)} className="rounded-full bg-[var(--color-gold)] px-3 py-1.5 text-xs font-medium text-white">Save</button>
          <button onClick={onDone} className="text-xs text-[var(--color-stone)]">Cancel</button>
        </div>
      ) : (
        <div>
          <p className="mb-1 text-[0.7rem] font-medium text-[var(--color-stone)]">Add people</p>
          <div className="max-h-28 space-y-0.5 overflow-y-auto">
            {candidates.length === 0 && <p className="text-xs text-[var(--color-stone)]">Everyone’s already here.</p>}
            {candidates.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-[var(--color-bone)]">
                <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id))} />
                <Avatar name={r.name} photo={r.photoUrl} size={20} /><span className="truncate">{r.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={onDone} className="text-xs text-[var(--color-stone)]">Cancel</button>
            <button disabled={!picked.length} onClick={() => void api({ op: 'addMembers', channelId, memberIds: picked }).then(onDone)} className="rounded-full bg-[var(--color-gold)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">Add</button>
          </div>
        </div>
      )}
    </div>
  );
}
