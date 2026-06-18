'use client';

import { useState } from 'react';
import { MentionInput } from './MentionInput';

type Note = { id: string; body: string; author: string; createdAt: string };

export function ConsultationNotes({ consultationId, initial }: { consultationId: string; initial: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initial);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/consultations/${consultationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const j = await r.json() as { ok: boolean; error?: string; note?: Note };
      if (!j.ok) { setError(j.error || 'Failed to save note.'); return; }
      if (j.note) setNotes((prev) => [...prev, { ...j.note!, createdAt: j.note!.createdAt }]);
      setBody('');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {notes.length === 0 && (
          <p className="text-sm text-[var(--color-stone)]">No notes yet — start the thread below.</p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3">
            <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
            <p className="mt-1.5 text-xs text-[var(--color-stone)]">
              {new Date(n.createdAt).toLocaleString('en-GB')} · {n.author}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <MentionInput
          value={body}
          onChange={setBody}
          onSubmit={submit}
          multiline
          placeholder="Add a note… (@ to mention a colleague)"
          className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-ink)]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={saving || !body.trim()}
          className="shrink-0 rounded-[var(--radius-md)] bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-40"
        >
          {saving ? '…' : 'Post'}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--color-blush)]">{error}</p>}
    </div>
  );
}
