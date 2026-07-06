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
  const [emails, setEmails] = useState<{ id: string; to: string; subject: string; status: string; openedAt: string | null; createdAt: string; chatKind: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => { if (typeof document !== 'undefined' && document.hidden) return; try { const r = await post({ op: 'list' }); if (r.ok) setConvos(r.conversations); } catch { /* transient */ } }, []);
  // `initial` marks a fresh open: show a loading state and surface any error
  // instead of silently leaving an empty panel (the old bug). Polling refreshes
  // pass initial=false so a transient blip never blanks a loaded thread.
  const loadThread = useCallback(async (id: string, initial = false) => {
    // Pause the 5s refresh when the tab is hidden; a fresh open always loads.
    if (!initial && typeof document !== 'undefined' && document.hidden) return;
    if (initial) { setLoading(true); setThreadError(null); }
    try {
      const r = await post({ op: 'messages', conversationId: id });
      if (r.ok && r.conversation) { setMeta(r.conversation); setMsgs(r.messages || []); setEmails(r.emails || []); setThreadError(null); }
      else if (initial) setThreadError(r.error || 'This conversation could not be loaded.');
    } catch {
      if (initial) setThreadError('Network error — please retry.');
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); const t = setInterval(loadList, 6000); return () => clearInterval(t); }, [loadList]);
  useEffect(() => {
    if (!activeId) return;
    // Clear the previous thread immediately so stale messages never linger.
    setMeta(null); setMsgs([]);
    loadThread(activeId, true);
    const t = setInterval(() => loadThread(activeId, false), 5000);
    return () => clearInterval(t);
  }, [activeId, loadThread]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [msgs]);

  async function open(id: string) { setActiveId(id); setConvos((c) => c.map((x) => (x.id === id ? { ...x, staffUnread: 0 } : x))); }
  async function reply(email = false) {
    const body = draft.trim(); if (!body || !activeId) return;
    const tmpId = `tmp-${Date.now()}`;
    setBusy(true); setDraft('');
    setMsgs((m) => [...m, { id: tmpId, sender: 'STAFF', author: 'you', body, createdAt: new Date().toISOString() }]);
    const r = await post({ op: 'reply', conversationId: activeId, body, email });
    setBusy(false);
    if (r.ok) { loadThread(activeId); loadList(); }
    else {
      // Roll back the optimistic bubble and restore the draft so nothing is lost.
      setMsgs((m) => m.filter((x) => x.id !== tmpId));
      setDraft(body);
      alert(r.error || 'Your reply could not be sent. Please try again.');
    }
  }
  async function close() { if (!activeId) return; await post({ op: 'close', conversationId: activeId }); loadThread(activeId); loadList(); }
  async function emailTranscript() {
    if (!activeId) return;
    setBusy(true);
    const r = await post({ op: 'emailTranscript', conversationId: activeId });
    setBusy(false);
    if (r.ok) loadThread(activeId); else alert(r.error || 'Could not email the transcript.');
  }
  async function setMode(mode: 'AI' | 'STAFF') {
    if (!activeId) return;
    setMeta((m) => (m ? { ...m, mode } : m));
    await post({ op: 'setMode', conversationId: activeId, mode });
    loadThread(activeId); loadList();
  }

  // Fall back to the conversation-list row so the header + email button work
  // even if a thread refresh is mid-flight or briefly failed.
  const active = convos.find((c) => c.id === activeId) || null;
  const headerName = meta?.visitorName ?? active?.visitorName ?? null;
  const headerEmail = meta?.visitorEmail ?? active?.visitorEmail ?? null;

  return (
    <div className="grid h-[70vh] gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Conversation list */}
      <div className="overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {convos.length === 0 && <p className="p-4 text-sm text-[var(--color-stone)]">No conversations yet.</p>}
        {convos.map((c) => (
          <button key={c.id} onClick={() => open(c.id)} className={`block w-full border-b border-[var(--color-line)] px-4 py-3 text-left last:border-0 ${activeId === c.id ? 'bg-[var(--color-bone)]' : 'hover:bg-[var(--color-bone)]'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{c.visitorName || c.visitorEmail || 'Visitor'}</span>
              {c.staffUnread > 0 && <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6rem] font-semibold text-amber-950">{c.staffUnread}</span>}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--color-stone)]">{c.preview}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">
              <span className={`rounded px-1 py-px font-semibold not-italic ${c.mode === 'AI' ? 'bg-[var(--color-bone)] text-[var(--color-gold)]' : 'bg-[var(--color-ink)] text-[var(--color-porcelain)]'}`}>{c.mode === 'AI' ? 'AI' : 'Staff'}</span>
              <span>{c.status === 'CLOSED' ? 'Closed' : 'Open'} · {fmt(c.lastMessageAt)}</span>
            </p>
          </button>
        ))}
      </div>

      {/* Thread */}
      <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        {!activeId ? (
          <div className="grid flex-1 place-items-center text-sm text-[var(--color-stone)]">Select a conversation.</div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <div>
                <p className="font-medium">{headerName || 'Visitor'}{headerEmail ? ` · ${headerEmail}` : ''}</p>
                <p className="text-xs text-[var(--color-stone)]">
                  {meta?.mode === 'AI' ? 'AI assistant is handling this chat' : 'You are handling this chat'}
                  {meta?.page ? ` · from ${meta.page}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {headerEmail && <button onClick={emailTranscript} disabled={busy} title={`Email the chat to ${headerEmail}`} className="font-medium text-[var(--color-gold-deep)] hover:underline disabled:opacity-50">✉ Email chat</button>}
                {meta?.mode === 'AI'
                  ? <button onClick={() => setMode('STAFF')} className="font-medium text-[var(--color-gold-deep)] hover:underline">Take over</button>
                  : <button onClick={() => setMode('AI')} className="font-medium text-[var(--color-gold-deep)] hover:underline">Resume AI</button>}
                <button onClick={close} className="text-[var(--color-stone)] hover:text-[var(--color-blush)]">Close chat</button>
              </div>
            </div>
            {emails.length > 0 && (
              <div className="border-b border-[var(--color-line)] bg-[var(--color-bone)]/40 px-4 py-1.5 text-[0.65rem] text-[var(--color-stone)]">
                <span className="font-medium text-[var(--color-stone)]">Emails sent:</span>{' '}
                {emails.slice(0, 4).map((e) => (
                  <span key={e.id} className="mr-2 whitespace-nowrap">{e.chatKind === 'transcript' ? 'transcript' : 'reply'} · {e.status.toLowerCase()}{e.openedAt ? ' · opened' : ''} · {fmt(e.createdAt)}</span>
                ))}
              </div>
            )}
            <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto p-4">
              {msgs.length === 0 && loading && <p className="grid h-full place-items-center text-sm text-[var(--color-stone)]">Loading conversation…</p>}
              {msgs.length === 0 && !loading && threadError && (
                <div className="grid h-full place-items-center text-center text-sm text-[var(--color-stone)]">
                  <div>
                    <p>{threadError}</p>
                    <button onClick={() => activeId && loadThread(activeId, true)} className="mt-2 rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs hover:bg-[var(--color-bone)]">Retry</button>
                  </div>
                </div>
              )}
              {msgs.length === 0 && !loading && !threadError && <p className="grid h-full place-items-center text-sm text-[var(--color-stone)]">No messages in this conversation yet.</p>}
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
              <button onClick={() => reply(false)} disabled={busy || !draft.trim()} className="rounded-[var(--radius-sm)] bg-[var(--color-gold)] px-4 text-sm font-medium text-white disabled:opacity-50">Send</button>
              {headerEmail && (
                <button onClick={() => reply(true)} disabled={busy || !draft.trim()} title={`Send and email ${headerEmail}`} className="rounded-[var(--radius-sm)] border border-[var(--color-gold)] px-3 text-xs font-medium text-[var(--color-gold-deep)] disabled:opacity-50">Send + email</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
