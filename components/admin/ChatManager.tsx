'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Convo = { id: string; visitorName: string | null; visitorEmail: string | null; status: string; mode: string; staffUnread: number; lastMessageAt: string; preview: string };
type Msg = { id: string; sender: string; author: string | null; body: string; createdAt: string };

async function post(payload: object) {
  const r = await fetch('/api/admin/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function ChatManager() {
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ visitorName: string | null; visitorEmail: string | null; status: string; mode: string; page?: string | null } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => { const r = await post({ op: 'list' }); if (r.ok) setConvos(r.conversations); }, []);
  const loadThread = useCallback(async (id: string) => {
    const r = await post({ op: 'messages', conversationId: id });
    if (r.ok) { setMeta(r.conversation); setMsgs(r.messages); }
  }, []);

  useEffect(() => { loadList(); const t = setInterval(loadList, 6000); return () => clearInterval(t); }, [loadList]);
  useEffect(() => { if (!activeId) return; loadThread(activeId); const t = setInterval(() => loadThread(activeId), 5000); return () => clearInterval(t); }, [activeId, loadThread]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [msgs]);

  async function open(id: string) { setActiveId(id); setConvos((c) => c.map((x) => (x.id === id ? { ...x, staffUnread: 0 } : x))); }
  async function reply() {
    const body = draft.trim(); if (!body || !activeId) return;
    setBusy(true); setDraft('');
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, sender: 'STAFF', author: 'you', body, createdAt: new Date().toISOString() }]);
    await post({ op: 'reply', conversationId: activeId, body });
    setBusy(false); loadThread(activeId); loadList();
  }
  async function close() { if (!activeId) return; await post({ op: 'close', conversationId: activeId }); loadThread(activeId); loadList(); }
  async function setMode(mode: 'AI' | 'STAFF') {
    if (!activeId) return;
    setMeta((m) => (m ? { ...m, mode } : m));
    await post({ op: 'setMode', conversationId: activeId, mode });
    loadThread(activeId); loadList();
  }

  return (
    <div className="grid h-[70vh] gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Conversation list */}
      <div className="overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {convos.length === 0 && <p className="p-4 text-sm text-[var(--color-stone-soft)]">No conversations yet.</p>}
        {convos.map((c) => (
          <button key={c.id} onClick={() => open(c.id)} className={`block w-full border-b border-[var(--color-line)] px-4 py-3 text-left last:border-0 ${activeId === c.id ? 'bg-[var(--color-bone)]' : 'hover:bg-[var(--color-bone)]'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{c.visitorName || c.visitorEmail || 'Visitor'}</span>
              {c.staffUnread > 0 && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-950">{c.staffUnread}</span>}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--color-stone)]">{c.preview}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone-soft)]">
              <span className={`rounded px-1 py-px font-semibold not-italic ${c.mode === 'AI' ? 'bg-[var(--color-bone)] text-[var(--color-gold)]' : 'bg-[var(--color-ink)] text-[var(--color-porcelain)]'}`}>{c.mode === 'AI' ? 'AI' : 'Staff'}</span>
              <span>{c.status === 'CLOSED' ? 'Closed' : 'Open'} · {fmt(c.lastMessageAt)}</span>
            </p>
          </button>
        ))}
      </div>

      {/* Thread */}
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {!activeId ? (
          <div className="grid flex-1 place-items-center text-sm text-[var(--color-stone-soft)]">Select a conversation.</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <div>
                <p className="font-medium">{meta?.visitorName || 'Visitor'}{meta?.visitorEmail ? ` · ${meta.visitorEmail}` : ''}</p>
                <p className="text-xs text-[var(--color-stone-soft)]">
                  {meta?.mode === 'AI' ? 'AI assistant is handling this chat' : 'You are handling this chat'}
                  {meta?.page ? ` · from ${meta.page}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {meta?.mode === 'AI'
                  ? <button onClick={() => setMode('STAFF')} className="font-medium text-[var(--color-gold)] hover:underline">Take over</button>
                  : <button onClick={() => setMode('AI')} className="font-medium text-[var(--color-gold)] hover:underline">Resume AI</button>}
                <button onClick={close} className="text-[var(--color-stone)] hover:text-[var(--color-blush)]">Close chat</button>
              </div>
            </div>
            <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto p-4">
              {msgs.map((m) => {
                const mine = m.sender !== 'VISITOR'; // staff + AI on the right
                const tone = m.sender === 'AI' ? 'ml-auto bg-[color-mix(in_oklab,var(--color-gold)_16%,var(--color-porcelain))] text-[var(--color-ink)]'
                  : m.sender === 'STAFF' ? 'ml-auto bg-[var(--color-ink)] text-[var(--color-porcelain)]'
                  : 'bg-[var(--color-bone)]';
                return (
                  <div key={m.id} className={`max-w-[75%] rounded-[var(--radius-md)] px-3 py-2 text-sm ${tone}`}>
                    {m.sender === 'AI' && <span className="mb-0.5 block text-[0.6rem] font-semibold uppercase tracking-wide opacity-70">AI assistant</span>}
                    {m.body}
                    <span className="mt-1 block text-[0.6rem] opacity-60">{fmt(m.createdAt)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 border-t border-[var(--color-line)] p-3">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply(); } }} placeholder="Type your reply…" className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
              <button onClick={reply} disabled={busy || !draft.trim()} className="rounded-[var(--radius-sm)] bg-[var(--color-gold)] px-4 text-sm font-medium text-white disabled:opacity-50">Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
