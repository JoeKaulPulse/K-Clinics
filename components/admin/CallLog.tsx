'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Call = {
  id: string; direction: 'INBOUND' | 'OUTBOUND'; fromNumber: string; toNumber: string;
  status: string | null; startedAt: string; durationSec: number;
  recordingUrl: string | null; transcriptStatus: string; hasTranscript: boolean;
  matchType: string; matchedLabel: string | null; client: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  agentEmail: string | null; notes: string | null;
};
type Detail = Call & { transcript: string | null; answeredAt: string | null; endedAt: string | null; recordingMime: string | null };

const FILTERS = [['all', 'All'], ['inbound', 'Inbound'], ['outbound', 'Outbound'], ['missed', 'Missed']] as const;

async function post(payload: object) {
  const r = await fetch('/api/admin/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}
const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDur = (s: number) => (s <= 0 ? '—' : `${Math.floor(s / 60)}m ${s % 60}s`);

export function CallLog({ canManage }: { canManage: boolean }) {
  const [filter, setFilter] = useState<typeof FILTERS[number][0]>('all');
  const [calls, setCalls] = useState<Call[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteMsg, setNoteMsg] = useState('');

  const load = useCallback(async () => {
    const r = await post({ op: 'list', filter });
    if (r.ok) setCalls(r.calls);
  }, [filter]);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const openCall = useCallback(async (id: string) => {
    setActiveId(id); setDetail(null);
    const r = await post({ op: 'get', id });
    if (r.ok) { setDetail(r.call); setNote(r.call.notes || ''); }
  }, []);

  async function saveNote() {
    if (!activeId) return;
    setSavingNote(true);
    const r = await post({ op: 'note', id: activeId, notes: note });
    setSavingNote(false);
    if (r.ok) { setNoteMsg('Saved ✓'); load(); }
    else setNoteMsg(r.error || 'Could not save note — your text is still here.');
  }

  async function dial(to: string) {
    const r = await post({ op: 'dial', to });
    alert(r.ok ? 'Calling… your yay handset will ring, then connect to the number.' : (r.error || 'Could not place the call.'));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        <div className="flex gap-1 border-b border-[var(--color-line)] p-2">
          {FILTERS.map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${filter === k ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)] hover:bg-[var(--color-bone)]'}`}>{label}</button>
          ))}
        </div>
        {calls.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-stone-soft)]">No calls yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {calls.map((c) => {
              const ext = c.direction === 'INBOUND' ? c.fromNumber : c.toNumber;
              const missed = ['missed', 'no-answer', 'busy', 'failed'].includes((c.status || '').toLowerCase());
              return (
                <li key={c.id}>
                  <button onClick={() => openCall(c.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bone)] ${activeId === c.id ? 'bg-[var(--color-bone)]' : ''}`}>
                    <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm ${missed ? 'bg-[var(--color-blush)]/20 text-[var(--color-blush)]' : c.direction === 'INBOUND' ? 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' : 'bg-[var(--color-gold)]/15 text-[var(--color-gold)]'}`}>
                      {c.direction === 'INBOUND' ? '↘' : '↗'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.client ? c.client.name : c.supplier ? c.supplier.name : (c.matchedLabel || ext)}</span>
                        {c.client && <span className="rounded-full bg-[var(--color-gold)]/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-[var(--color-gold)]">Client</span>}
                        {c.supplier && <span className="rounded-full bg-[var(--color-jade)]/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-[var(--color-jade)]">Supplier</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--color-stone-soft)]">{ext} · {fmtTime(c.startedAt)} · {fmtDur(c.durationSec)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone-soft)]">
                      {c.recordingUrl && <span title="Recording available">●</span>}
                      {c.hasTranscript && <span title="Transcript available" className="text-[var(--color-gold)]">T</span>}
                      {missed && <span className="text-[var(--color-blush)]">missed</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detail */}
      <aside className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        {!detail ? (
          <p className="text-sm text-[var(--color-stone-soft)]">Select a call to see details, recording and transcript.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{detail.direction === 'INBOUND' ? 'Inbound call' : 'Outbound call'}</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-xl">
                {detail.client ? <Link href={`/admin/clients/${detail.client.id}`} className="hover:text-[var(--color-gold)]">{detail.client.name}</Link>
                  : detail.supplier ? <Link href="/admin/suppliers" className="hover:text-[var(--color-gold)]">{detail.supplier.name}</Link>
                  : (detail.matchedLabel || (detail.direction === 'INBOUND' ? detail.fromNumber : detail.toNumber))}
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-stone)]">{detail.direction === 'INBOUND' ? detail.fromNumber : detail.toNumber} · {fmtTime(detail.startedAt)} · {fmtDur(detail.durationSec)}</p>
              {detail.agentEmail && <p className="text-xs text-[var(--color-stone-soft)]">Handled by {detail.agentEmail}</p>}
            </div>

            {detail.recordingUrl ? (
              <audio controls preload="none" src={detail.recordingUrl} className="w-full" />
            ) : (
              <p className="text-xs text-[var(--color-stone-soft)]">No recording for this call.</p>
            )}

            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">Transcript</p>
              {detail.transcript ? (
                <p className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-3 text-sm leading-relaxed">{detail.transcript}</p>
              ) : (
                <p className="text-sm text-[var(--color-stone-soft)]">{detail.transcriptStatus === 'unavailable' ? 'No transcript available.' : 'Transcript pending — it’ll appear once yay.com finishes processing.'}</p>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">Note</p>
              <textarea value={note} onChange={(e) => { setNote(e.target.value); if (noteMsg) setNoteMsg(''); }} disabled={!canManage} rows={3} placeholder={canManage ? 'Add a note about this call…' : 'No note'} className="w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white p-2.5 text-sm outline-none focus:border-[var(--color-gold)] disabled:opacity-60" />
              {canManage && (
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={saveNote} disabled={savingNote} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{savingNote ? 'Saving…' : 'Save note'}</button>
                  <button onClick={() => dial(detail.direction === 'INBOUND' ? detail.fromNumber : detail.toNumber)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm font-medium hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]">Call back</button>
                  {noteMsg && <span className="text-xs text-[var(--color-stone)]">{noteMsg}</span>}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
