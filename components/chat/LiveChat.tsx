'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type Msg = { id: string; sender: string; body: string; createdAt: string };
const TOKEN_KEY = 'kc_chat_token';

export function LiveChat() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const lastAt = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { setToken(localStorage.getItem(TOKEN_KEY)); }, []);

  const poll = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`/api/chat?token=${encodeURIComponent(tok)}${lastAt.current ? `&after=${encodeURIComponent(lastAt.current)}` : ''}`);
      const j = await res.json();
      if (j.ok && j.messages?.length) {
        setMsgs((prev) => {
          const seen = new Set(prev.map((m: Msg) => m.id));
          const next = [...prev, ...j.messages.filter((m: Msg) => !seen.has(m.id))];
          lastAt.current = next[next.length - 1]?.createdAt ?? lastAt.current;
          return next;
        });
      }
    } catch { /* ignore */ }
  }, []);

  // Poll while the panel is open and a conversation exists.
  useEffect(() => {
    if (!open || !token) return;
    poll(token);
    const t = setInterval(() => poll(token), 4000);
    return () => clearInterval(t);
  }, [open, token, poll]);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [msgs, open]);

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    // optimistic
    const optimistic: Msg = { id: `tmp-${Date.now()}`, sender: 'VISITOR', body, createdAt: new Date().toISOString() };
    setMsgs((m) => [...m, optimistic]);
    setDraft('');
    try {
      if (!token) {
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'start', message: body, email: email || undefined, page: location.pathname }) });
        const j = await res.json();
        if (j.ok) { localStorage.setItem(TOKEN_KEY, j.token); setToken(j.token); lastAt.current = optimistic.createdAt; }
      } else {
        await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'send', token, message: body }) });
      }
    } catch { /* keep optimistic */ }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 hidden md:block print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-lift)]"
          >
            <div className="surface-ink flex items-center justify-between px-4 py-3 text-[var(--color-porcelain)]">
              <div>
                <p className="font-[family-name:var(--font-display)] text-lg leading-none">Chat with K Clinics</p>
                <p className="mt-1 text-[0.7rem] text-[color-mix(in_oklab,var(--color-porcelain)_65%,transparent)]">Our assistant replies instantly · our team can jump in too.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10">✕</button>
            </div>

            <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto p-4">
              {msgs.length === 0 && <p className="text-sm text-[var(--color-stone)]">Hi 👋 I’m K, the K Clinics assistant. Ask me about treatments, pricing, opening hours or booking — and I’ll bring in our team whenever you need a person.</p>}
              {msgs.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-[var(--radius-md)] px-3 py-2 text-sm ${m.sender === 'VISITOR' ? 'ml-auto bg-[var(--color-gold)] text-white' : 'bg-[var(--color-bone)] text-[var(--color-ink)]'}`}>{m.body}</div>
              ))}
            </div>

            <div className="border-t border-[var(--color-line)] p-3">
              {!token && (
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional — so we can reply if you leave)" className="mb-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-xs outline-none focus:border-[var(--color-gold)]" />
              )}
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
                />
                <button onClick={send} disabled={busy || !draft.trim()} aria-label="Send" className="grid w-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-[var(--color-porcelain)] disabled:opacity-50">→</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Live chat"
        className="ml-auto flex items-center gap-2 rounded-full bg-[var(--color-ink)] py-3 pl-3 pr-4 text-[var(--color-porcelain)] shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-[var(--color-gold-soft)]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.1-5.1A8.5 8.5 0 1 1 21 11.5z" /></svg>
        <span className="text-sm font-medium">{open ? 'Close' : 'Live chat'}</span>
      </button>
    </div>
  );
}
