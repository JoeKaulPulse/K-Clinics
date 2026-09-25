'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useHideAtFooter } from '@/components/chat/useHideAtFooter';
import { Dialog } from '@/components/ui/Dialog';

type Msg = { id: string; sender: string; body: string; createdAt: string; from?: string; link?: string };
const TOKEN_KEY = 'kc_chat_token';
// BLD-1155: replies here can be AI-drafted (lib/chat-ai.ts sends the visitor's
// message to Anthropic) — a one-line, dismissable notice above the input says
// so on first open, mirroring the cookie banner's "remember the choice" pattern.
const AI_NOTICE_KEY = 'kc_chat_ai_notice_dismissed';

export function LiveChat() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAiNotice, setShowAiNotice] = useState(false);
  // BLD-1878: "email me this chat" used window.prompt() to collect the address
  // when none was already given — a native dialog with no branding that
  // silently no-ops (returns null immediately, capturing nothing) inside an
  // in-app/webview browser such as an email or SMS app's built-in viewer.
  // Replaced with an inline <Dialog> input. The follow-up alert() for the send
  // result is the same class of bug (a webview can drop it just as silently),
  // so it's shown inline too rather than via alert().
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [emailPromptValue, setEmailPromptValue] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const lastAt = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const messageInput = useRef<HTMLInputElement>(null);
  const atFooter = useHideAtFooter();

  useEffect(() => { setToken(localStorage.getItem(TOKEN_KEY)); }, []);
  useEffect(() => {
    try { if (!localStorage.getItem(AI_NOTICE_KEY)) setShowAiNotice(true); } catch { setShowAiNotice(true); }
  }, []);
  function dismissAiNotice() {
    try { localStorage.setItem(AI_NOTICE_KEY, '1'); } catch { /* private mode — still dismiss for this visit */ }
    setShowAiNotice(false);
  }

  const poll = useCallback(async (tok: string) => {
    try {
      const res = await fetch(`/api/chat?token=${encodeURIComponent(tok)}${lastAt.current ? `&after=${encodeURIComponent(lastAt.current)}` : ''}`);
      const j = await res.json();
      if (j.ok && j.messages?.length) {
        setMsgs((prev) => {
          const seen = new Set(prev.map((m: Msg) => m.id));
          const fresh = (j.messages as Msg[]).filter((m) => !seen.has(m.id));
          if (!fresh.length) return prev;
          // The server now echoes back the visitor's own messages with their
          // real ids. Drop the matching optimistic placeholders (temp id, same
          // text) so a sent message doesn't appear twice.
          const confirmed = new Set(fresh.filter((m) => m.sender === 'VISITOR').map((m) => m.body));
          const base = prev.filter((m) => !(m.id.startsWith('tmp-') && m.sender === 'VISITOR' && confirmed.has(m.body)));
          const next = [...base, ...fresh];
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

  // PRJ-1229.12: every other overlay moves focus in on open (useDialogBehaviours);
  // this panel is non-modal (no trap needed), so just focus the message input.
  useEffect(() => { if (open) messageInput.current?.focus(); }, [open]);

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

  // Visitor asks us to email them the conversation. Uses the email they left,
  // or opens the inline dialog to collect one.
  function emailMe() {
    if (!token) return;
    const addr = email.trim();
    if (addr) { sendTranscript(addr); return; }
    setEmailPromptValue('');
    setEmailPromptOpen(true);
  }

  async function sendTranscript(addr: string) {
    setEmailStatus('');
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'emailTranscript', token, email: addr }) });
      const j = await res.json();
      setEmailStatus(j.ok ? 'Sent — check your inbox (and spam, just in case).' : (j.error || 'Sorry, that didn’t send.'));
    } catch { setEmailStatus('Sorry, that didn’t send.'); }
  }

  // Light client-side shape check so a typo keeps the dialog open; the server
  // (/api/chat emailTranscript) still validates authoritatively.
  const emailPromptValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPromptValue.trim());
  function submitEmailPrompt() {
    const addr = emailPromptValue.trim();
    if (!emailPromptValid) return;
    setEmailPromptOpen(false);
    sendTranscript(addr);
  }

  return (
    <div className={`fixed bottom-5 right-5 z-40 hidden md:block print:hidden transition-all duration-300 ${atFooter && !open ? 'pointer-events-none translate-y-3 opacity-0' : 'opacity-100'}`}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] shadow-[var(--shadow-lift)]"
          >
            <div className="surface-ink flex items-center justify-between px-4 py-3 text-[var(--color-porcelain)]">
              <div>
                <p className="font-[family-name:var(--font-display)] text-lg leading-none">Chat with KClinics</p>
                <p className="mt-1 text-[0.7rem] text-[color-mix(in_oklab,var(--color-porcelain)_65%,transparent)]">Our assistant replies instantly · our team can jump in too.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10">✕</button>
            </div>

            <div ref={scroller} aria-live="polite" role="log" className="flex-1 space-y-2 overflow-y-auto p-4">
              {msgs.length === 0 && <p className="text-sm text-[var(--color-stone)]">Hello — I’m K, the KClinics assistant. Ask me about treatments, pricing, opening hours or booking, and I’ll bring in our team whenever you need a person.</p>}
              {msgs.map((m) => {
                const mine = m.sender === 'VISITOR';
                return (
                  <div key={m.id} className={mine ? 'ml-auto max-w-[80%]' : 'max-w-[80%]'}>
                    {!mine && m.from && (
                      <p className="mb-0.5 px-1 text-[0.6rem] font-medium uppercase tracking-wide text-[var(--color-stone)]">
                        {m.link ? <a href={m.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-ink)]">{m.from}</a> : m.from}
                      </p>
                    )}
                    <div className={`rounded-[var(--radius-md)] px-3 py-2 text-sm ${mine ? 'bg-[var(--color-gold-deep)] text-white' : 'bg-[var(--color-bone)] text-[var(--color-ink)]'}`}>{m.body}</div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[var(--color-line)] p-3">
              {showAiNotice && (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-2.5 py-2 text-[0.68rem] leading-snug text-[var(--color-stone)]">
                  <span>Replies may be AI-assisted; see our <Link href="/info/privacy-policy" className="underline hover:text-[var(--color-ink)]">Privacy Policy</Link>.</span>
                  <button type="button" onClick={dismissAiNotice} aria-label="Dismiss" className="shrink-0 text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
                </div>
              )}
              {!token && (
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional — so we can reply if you leave)" className="mb-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-xs outline-none focus:border-[var(--color-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]" />
              )}
              {token && msgs.length > 0 && (
                <div className="mb-2 flex items-center gap-2">
                  <button onClick={emailMe} className="text-[0.7rem] text-[var(--color-stone)] underline hover:text-[var(--color-ink)]">Email me this chat</button>
                  {emailStatus && <span role="status" aria-live="polite" className="text-[0.7rem] text-[var(--color-stone)]">{emailStatus}</span>}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={messageInput}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]"
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

      <Dialog open={emailPromptOpen} onClose={() => setEmailPromptOpen(false)} labelledby="chat-email-prompt-title">
        <div className="w-full max-w-xs rounded-t-[var(--radius-xl)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-xl)]">
          <div className="mb-1 flex items-center justify-between">
            <h2 id="chat-email-prompt-title" className="font-[family-name:var(--font-display)] text-lg">Email this chat</h2>
            <button onClick={() => setEmailPromptOpen(false)} aria-label="Close" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]"><span aria-hidden="true">✕</span></button>
          </div>
          <p className="mb-3 text-xs text-[var(--color-stone)]">What email should we send the conversation to?</p>
          <input
            type="email"
            autoFocus
            value={emailPromptValue}
            onChange={(e) => setEmailPromptValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitEmailPrompt(); } }}
            placeholder="you@example.com"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold-deep)]"
          />
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={() => setEmailPromptOpen(false)} className="px-4 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
            <button onClick={submitEmailPrompt} disabled={!emailPromptValid} className="rounded-full bg-[var(--color-gold-deep)] px-5 py-2 text-sm font-medium text-white disabled:opacity-50">Send</button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
