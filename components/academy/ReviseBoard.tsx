'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, AButton, Eyebrow, Pill, EmptyState, ProgressBar } from '@/components/academy/ui';
import type { DeckSummary, SessionCard } from '@/lib/flashcards';

// BLD-531: trainee flashcards. Pick a deck → flip through due + new cards → rate
// recall (Again/Good/Easy). "Again" re-queues the card to the end of this session;
// every rating is also sent to the server to schedule the card's next due date.

export function ReviseBoard({ decks }: { decks: DeckSummary[] }) {
  const router = useRouter();
  const [active, setActive] = useState<{ id: string; title: string } | null>(null);
  const [queue, setQueue] = useState<SessionCard[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  async function start(deck: DeckSummary) {
    setLoading(true); setActive({ id: deck.id, title: deck.title }); setFinished(false); setDone(0);
    const res = await fetch(`/api/academy/flashcards?deck=${encodeURIComponent(deck.id)}`).then((r) => r.json()).catch(() => null);
    setLoading(false);
    const cards: SessionCard[] = res?.ok ? res.cards ?? [] : [];
    setQueue(cards); setTotal(cards.length); setFlipped(false);
    if (cards.length === 0) setFinished(true);
  }

  async function rate(grade: 0 | 1 | 2) {
    const card = queue[0];
    if (!card) return;
    fetch('/api/academy/flashcards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: card.id, grade }) }).catch(() => {});
    setFlipped(false);
    setQueue((q) => {
      const [first, ...rest] = q;
      // "Again" → send to the back of this session; otherwise it's done for now.
      const next = grade === 0 ? [...rest, first] : rest;
      if (next.length === 0) setFinished(true);
      return next;
    });
    if (grade !== 0) setDone((d) => d + 1);
  }

  function exit() { setActive(null); setQueue([]); setFinished(false); router.refresh(); }

  // ── Review session ──
  if (active) {
    const card = queue[0];
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <Eyebrow>{active.title}</Eyebrow>
          <button onClick={exit} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← All decks</button>
        </div>
        {!finished && <ProgressBar pct={progress} className="mb-5" />}

        {loading ? (
          <Card className="p-10 text-center text-sm text-[var(--color-stone)]">Loading…</Card>
        ) : finished ? (
          <EmptyState title={total === 0 ? 'All caught up' : 'Session complete'} action={<AButton onClick={exit}>Back to decks →</AButton>}>
            {total === 0 ? 'Nothing is due in this deck right now — come back later and the cards you found hard will resurface first.' : `You reviewed ${done} card${done === 1 ? '' : 's'}. Nicely done — they’ll resurface for review based on how well you knew them.`}
          </EmptyState>
        ) : card ? (
          <>
            <Card tone="porcelain" className="min-h-[16rem] p-8">
              <p className="mb-2 text-center text-[0.65rem] uppercase tracking-[0.16em] text-[var(--color-stone)]">{flipped ? 'Answer' : 'Question'}</p>
              {card.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={card.imageUrl} alt="" className="mx-auto mb-4 max-h-48 rounded-[var(--radius-md)]" />}
              <p className="whitespace-pre-line text-center text-lg leading-relaxed text-[var(--color-ink)]">{flipped ? card.back : card.front}</p>
            </Card>

            <div className="mt-5">
              {!flipped ? (
                <div className="flex justify-center">
                  <AButton onClick={() => setFlipped(true)}>Show answer</AButton>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <AButton variant="secondary" onClick={() => rate(0)} className="!text-[var(--color-blush)]">Again</AButton>
                  <AButton variant="secondary" onClick={() => rate(1)}>Good</AButton>
                  <AButton variant="primary" onClick={() => rate(2)}>Easy</AButton>
                </div>
              )}
              <p className="mt-3 text-center text-xs text-[var(--color-stone)]">{queue.length} left in this session</p>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // ── Deck list ──
  if (decks.length === 0) {
    return <EmptyState title="No flashcards yet">Your trainers add revision decks per course. Once they’re published, your due cards appear here.</EmptyState>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {decks.map((d) => (
        <Card key={d.id} className="flex flex-col p-5">
          <div className="flex-1">
            <Eyebrow>{d.courseTitle}</Eyebrow>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-lg">{d.title}</h3>
            {d.description && <p className="mt-1 text-sm text-[var(--color-stone)]">{d.description}</p>}
            <div className="mt-3 flex items-center gap-2">
              {d.due > 0 ? <Pill tone="gold">{d.due} due</Pill> : <Pill tone="good">Caught up</Pill>}
              <span className="text-xs text-[var(--color-stone)]">{d.total} card{d.total === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div className="mt-4">
            <AButton onClick={() => start(d)} variant={d.due > 0 ? 'primary' : 'secondary'} size="sm">{d.due > 0 ? 'Revise →' : 'Review again →'}</AButton>
          </div>
        </Card>
      ))}
    </div>
  );
}
