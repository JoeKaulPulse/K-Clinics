'use client';

import { useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { EmojiPicker, GifPicker } from './Pickers';
import { uploadFile } from './util';
import type { Channel, ChatMessage, DraftAttachment } from './types';

const ICON = 'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--color-stone)] transition-colors hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]';

export function Composer({ channel, meId, onSent, replyTo, onCancelReply }: {
  channel: Channel; meId: string;
  onSent: (m: ChatMessage) => void;
  replyTo?: ChatMessage | null; onCancelReply?: () => void;
}) {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<DraftAttachment[]>([]);
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(0);
  const [emoji, setEmoji] = useState(false);
  const [gif, setGif] = useState(false);
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null);
  const [mIdx, setMIdx] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const candidates = channel.members.filter((m) => m.id !== meId);
  const mentionMatches = mention
    ? candidates.filter((m) => m.name.toLowerCase().includes(mention.query.toLowerCase()) || m.email.toLowerCase().startsWith(mention.query.toLowerCase())).slice(0, 6)
    : [];

  function onChange(v: string) {
    setText(v);
    const caret = taRef.current?.selectionStart ?? v.length;
    const upto = v.slice(0, caret);
    const m = /(?:^|\s)@([\p{L}\d'’.\-]*)$/u.exec(upto);
    if (m) { setMention({ query: m[1], index: caret - m[1].length - 1 }); setMIdx(0); }
    else setMention(null);
  }

  function chooseMention(memberId: string, name: string) {
    if (!mention) return;
    const before = text.slice(0, mention.index);
    const after = text.slice((taRef.current?.selectionStart ?? text.length));
    const next = `${before}@${name} ${after}`;
    setText(next);
    setPicked((p) => (p.some((x) => x.id === memberId) ? p : [...p, { id: memberId, name }]));
    setMention(null);
    requestAnimationFrame(() => taRef.current?.focus());
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading((n) => n + files.length);
    for (const f of Array.from(files).slice(0, 10)) {
      try { const a = await uploadFile(f); setDrafts((d) => [...d, a]); setError(''); }
      catch (e) { setError((e as Error)?.message || 'Upload failed.'); }
      finally { setUploading((n) => Math.max(0, n - 1)); }
    }
  }

  async function send() {
    const body = text.trim();
    if ((!body && drafts.length === 0) || sending) return;
    setSending(true); setError('');
    const mentionIds = picked.filter((p) => body.includes(`@${p.name.split(' ')[0]}`)).map((p) => p.id);
    const mentionsAll = /@(everyone|channel|all|here)\b/i.test(body);
    try {
      const r = await fetch('/api/admin/team-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'send', channelId: channel.id, body, attachments: drafts, mentionIds, mentionsAll, replyToId: replyTo?.id }),
      }).then((x) => x.json());
      if (r?.ok && r.message) {
        onSent(r.message as ChatMessage);
        setText(''); setDrafts([]); setPicked([]); onCancelReply?.();
      } else {
        setError(r?.error || 'Couldn’t send — try again.');
      }
    } catch {
      setError('Network error — message not sent.');
    } finally { setSending(false); }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (mention && mentionMatches.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMIdx((i) => (i + 1) % mentionMatches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMIdx((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const m = mentionMatches[mIdx]; if (m) chooseMention(m.id, m.name); return; }
      if (e.key === 'Escape') { setMention(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  return (
    <div className="relative border-t border-[var(--color-line)] bg-[var(--color-porcelain)] px-2.5 py-2">
      {replyTo && (
        <div className="mb-1.5 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border-l-2 border-[var(--color-gold)] bg-[var(--color-bone)]/60 px-2 py-1 text-xs">
          <span className="truncate text-[var(--color-stone)]">Replying to <b className="text-[var(--color-ink)]">{replyTo.authorName}</b>: {replyTo.body.slice(0, 60) || 'attachment'}</span>
          <button onClick={onCancelReply} className="text-[var(--color-stone)] hover:text-[var(--color-ink)]" aria-label="Cancel reply">✕</button>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {drafts.map((d, i) => (
            <div key={`${d.url}-${i}`} className="relative">
              {d.kind === 'VIDEO'
                ? <video src={d.url} className="h-14 w-14 rounded-[var(--radius-sm)] border border-[var(--color-line)] object-cover" />
                : d.kind === 'FILE'
                  ? <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white text-2xl">📄</span>
                  : <img src={d.url} alt="" className="h-14 w-14 rounded-[var(--radius-sm)] border border-[var(--color-line)] object-cover" />}
              <button onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-ink)] text-[0.6rem] text-white" aria-label="Remove">✕</button>
            </div>
          ))}
          {uploading > 0 && <span className="grid h-14 w-14 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] text-[0.6rem] text-[var(--color-stone)]">Uploading…</span>}
        </div>
      )}

      {/* @-mention autocomplete */}
      {mention && mentionMatches.length > 0 && (
        <div className="absolute bottom-[3.4rem] left-2 z-[60] w-56 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-lift)]">
          {mentionMatches.map((m, i) => (
            <button
              key={m.id} type="button" onMouseEnter={() => setMIdx(i)} onClick={() => chooseMention(m.id, m.name)}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm ${i === mIdx ? 'bg-[var(--color-bone)]' : ''}`}
            >
              <Avatar name={m.name} photo={m.photoUrl} size={22} /><span className="truncate">{m.name}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-1 px-1 text-xs text-[#b23b3b]">{error}</p>}

      <div className="flex items-end gap-1">
        <button type="button" className={ICON} onClick={() => fileRef.current?.click()} aria-label="Attach file" title="Attach photo, video or file">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10l4-4a2.5 2.5 0 013.5 3.5l-6 6a4 4 0 01-5.7-5.7l6-6" /></svg>
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        <div className="relative">
          <button type="button" className={ICON} onClick={() => { setGif((v) => !v); setEmoji(false); }} aria-label="Add a GIF" title="Add a GIF"><span className="text-[0.65rem] font-bold tracking-tight">GIF</span></button>
          {gif && <GifPicker onPick={(g) => { setDrafts((d) => [...d, g]); setGif(false); }} onClose={() => setGif(false)} />}
        </div>
        <div className="relative">
          <button type="button" className={ICON} onClick={() => { setEmoji((v) => !v); setGif(false); }} aria-label="Add emoji" title="Emoji"><span className="text-base leading-none">😊</span></button>
          {emoji && <EmojiPicker onPick={(e) => { setText((t) => t + e); setEmoji(false); requestAnimationFrame(() => taRef.current?.focus()); }} onClose={() => setEmoji(false)} />}
        </div>

        <textarea
          ref={taRef} rows={1} value={text}
          onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Message…"
          className="max-h-28 min-h-[2.25rem] flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]"
        />
        <button
          type="button" onClick={() => void send()} disabled={sending || (!text.trim() && drafts.length === 0)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-gold)] text-white transition-colors hover:bg-[var(--color-gold-deep)] disabled:opacity-40"
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l14-7-7 14-2-5-5-2z" /></svg>
        </button>
      </div>
    </div>
  );
}
