'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminDeck } from '@/lib/flashcards';

// BLD-531: staff authoring for flashcard decks + cards (per course).
const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const label = 'block text-xs font-medium text-[var(--color-stone)]';
const btnDark = 'rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-[var(--color-porcelain)] disabled:opacity-50';
const btnGhost = 'text-xs text-[var(--color-stone)] hover:text-[var(--color-ink)] disabled:opacity-40';

async function post(payload: object) {
  return fetch('/api/admin/flashcards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function FlashcardsManager({ courseId, decks }: { courseId: string; decks: AdminDeck[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(payload: object) { setBusy(true); await post(payload); setBusy(false); router.refresh(); }

  return (
    <div className="space-y-5">
      <button onClick={() => act({ op: 'createDeck', courseId, title: 'New deck' })} disabled={busy} className={btnDark}>+ New deck</button>
      {decks.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-stone)]">No decks yet. Create one, then add cards (front = prompt, back = answer). Trainees revise them with spaced repetition.</p>
      ) : decks.map((d) => <DeckRow key={d.id} deck={d} busy={busy} act={act} />)}
    </div>
  );
}

function DeckRow({ deck, busy, act }: { deck: AdminDeck; busy: boolean; act: (p: object) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(deck.title);
  const [description, setDescription] = useState(deck.description ?? '');
  const dirty = title !== deck.title || description !== (deck.description ?? '');
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--color-stone)]">{open ? '▾' : '▸'}</button>
        <span className="flex-1 text-sm font-medium">{deck.title} <span className="text-[var(--color-stone)]">· {deck.cards.length} card{deck.cards.length === 1 ? '' : 's'}</span></span>
        <button onClick={() => { if (confirm('Delete this deck and its cards? Trainees’ review history for it is removed too.')) act({ op: 'deleteDeck', id: deck.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[var(--color-line)] p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className={label}>Deck title<input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className={label}>Description (optional)<input className={`${field} mt-1`} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          </div>
          {dirty && <button onClick={() => act({ op: 'updateDeck', id: deck.id, title, description })} disabled={busy} className={btnDark}>Save deck</button>}

          <div className="space-y-2">
            {deck.cards.map((c, i) => <CardRow key={c.id} card={c} index={i} total={deck.cards.length} ids={deck.cards.map((x) => x.id)} busy={busy} act={act} />)}
          </div>
          <button onClick={() => act({ op: 'createCard', deckId: deck.id })} disabled={busy} className="text-xs font-medium text-[var(--color-gold)] hover:underline">+ Add card</button>
        </div>
      )}
    </div>
  );
}

function CardRow({ card, index, total, ids, busy, act }: { card: AdminDeck['cards'][number]; index: number; total: number; ids: string[]; busy: boolean; act: (p: object) => Promise<void> }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [imageUrl, setImageUrl] = useState(card.imageUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const dirty = front !== card.front || back !== card.back || imageUrl !== (card.imageUrl ?? '');
  const move = (d: number) => { const a = [...ids]; const j = index + d; if (j < 0 || j >= a.length) return; [a[index], a[j]] = [a[j], a[index]]; act({ op: 'reorderCards', ids: a }); };

  async function upload(file: File) {
    setUploading(true);
    try {
      const { uploadBlob } = await import('@/lib/upload-client');
      const url = await uploadBlob(file, { folder: 'academy/flashcards', clientUploadUrl: '/api/admin/academy/blob-token' });
      setImageUrl(url);
    } catch (e) { alert('Image upload failed: ' + ((e as Error)?.message || 'unknown')); }
    finally { setUploading(false); }
  }

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs text-[var(--color-stone)]">Card {index + 1}</span>
        <span className="flex-1" />
        <button onClick={() => move(-1)} disabled={busy || index === 0} className={btnGhost}>↑</button>
        <button onClick={() => move(1)} disabled={busy || index === total - 1} className={btnGhost}>↓</button>
        <button onClick={() => { if (confirm('Delete this card?')) act({ op: 'deleteCard', id: card.id }); }} disabled={busy} className="text-xs text-[var(--color-blush)] hover:underline">Delete</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={label}>Front (prompt)<textarea rows={3} className={`${field} mt-1`} value={front} onChange={(e) => setFront(e.target.value)} /></label>
        <label className={label}>Back (answer)<textarea rows={3} className={`${field} mt-1`} value={back} onChange={(e) => setBack(e.target.value)} /></label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={imageUrl} alt="" className="max-h-16 rounded-[var(--radius-sm)] border border-[var(--color-line)]" />}
        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-1.5 text-xs ${uploading ? 'opacity-60' : 'hover:border-[var(--color-gold)]'}`}>
          {uploading ? 'Uploading…' : imageUrl ? '↑ Replace image' : '↑ Add image'}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
        </label>
        {imageUrl && <button onClick={() => setImageUrl('')} className="text-xs text-[var(--color-blush)] hover:underline">Remove image</button>}
        <span className="flex-1" />
        {dirty && <button onClick={() => act({ op: 'updateCard', id: card.id, front, back, imageUrl })} disabled={busy} className={btnDark}>Save card</button>}
      </div>
    </div>
  );
}
