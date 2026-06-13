'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type StudentRow = {
  id: string; firstName: string; lastName: string | null; email: string; phone: string | null;
  createdAt: string; lastLoginAt: string | null; portalActive: boolean; onboardedAt: string | null; notes: string | null;
  lessonsCompleted: number; quizAttempts: number;
  enrolments: { courseTitle: string; status: string }[];
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const statusTone: Record<string, string> = {
  APPLIED: 'bg-[var(--color-stone)]/12 text-[var(--color-stone)]',
  OFFERED: 'bg-[var(--color-gold)]/15 text-[var(--color-gold)]',
  PAID: 'bg-[var(--color-gold)]/15 text-[var(--color-gold)]',
  ENROLLED: 'bg-[var(--color-sage,#5b7a5b)]/15 text-[var(--color-ink)]',
  COMPLETED: 'bg-[var(--color-sage,#5b7a5b)]/20 text-[var(--color-ink)]',
  CANCELLED: 'bg-[var(--color-blush)]/15 text-[var(--color-blush)]',
};

async function post(payload: object) {
  return fetch('/api/admin/academy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function StudentsManager({ students }: { students: StudentRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students.filter((s) => {
      if (onlyActive && !s.portalActive) return false;
      if (!needle) return true;
      return `${s.firstName} ${s.lastName ?? ''} ${s.email} ${s.phone ?? ''}`.toLowerCase().includes(needle);
    });
  }, [students, q, onlyActive]);

  async function act(payload: object) { await post(payload); router.refresh(); }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Trainees</h2>
          <p className="text-sm text-[var(--color-stone)]">{students.length} portal account{students.length === 1 ? '' : 's'}. Suspend access, add notes, and see each trainee’s progress.</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email…" className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm" />
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-stone)]"><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />Active only</label>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-stone-soft)]">{students.length === 0 ? 'No trainee accounts yet. Trainees appear here once they sign up to the portal.' : 'No trainees match your search.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone-soft)]">
              <th className="py-1 pr-2">Trainee</th><th className="px-2">Enrolments</th><th className="px-2">Progress</th><th className="px-2">Joined</th><th className="px-2">Last login</th><th className="px-2">Access</th>
            </tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-[var(--color-line)] align-top">
                  <td className="py-2 pr-2">
                    <span className="font-medium">{s.firstName} {s.lastName ?? ''}</span>
                    {!s.portalActive && <span className="ml-1 rounded-full bg-[var(--color-blush)]/15 px-1.5 py-0.5 text-[0.6rem] text-[var(--color-blush)]">Suspended</span>}
                    <span className="block text-xs text-[var(--color-stone-soft)]">{s.email}{s.phone ? ` · ${s.phone}` : ''}</span>
                    <NoteEditor notes={s.notes} onSave={(notes) => act({ op: 'updateStudentNotes', id: s.id, notes })} />
                  </td>
                  <td className="px-2">
                    {s.enrolments.length === 0 ? <span className="text-xs text-[var(--color-stone-soft)]">—</span> : (
                      <span className="flex flex-col gap-1">
                        {s.enrolments.map((e, i) => (
                          <span key={i} className="text-xs">
                            {e.courseTitle} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[0.6rem] ${statusTone[e.status] ?? 'bg-[var(--color-stone)]/12 text-[var(--color-stone)]'}`}>{e.status}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-2 text-xs text-[var(--color-stone)]">{s.lessonsCompleted} lesson{s.lessonsCompleted === 1 ? '' : 's'}<br />{s.quizAttempts} quiz attempt{s.quizAttempts === 1 ? '' : 's'}</td>
                  <td className="px-2 text-xs text-[var(--color-stone)]">{fmtDate(s.createdAt)}</td>
                  <td className="px-2 text-xs text-[var(--color-stone)]">{fmtDate(s.lastLoginAt)}</td>
                  <td className="px-2">
                    <button
                      onClick={() => { if (s.portalActive ? confirm(`Suspend ${s.firstName}’s portal access?`) : true) act({ op: 'setStudentActive', id: s.id, active: !s.portalActive }); }}
                      className={`rounded-full border px-3 py-1 text-xs ${s.portalActive ? 'border-[var(--color-line)] text-[var(--color-stone)] hover:border-[var(--color-blush)] hover:text-[var(--color-blush)]' : 'border-[var(--color-gold)] text-[var(--color-gold)]'}`}
                    >{s.portalActive ? 'Suspend' : 'Reactivate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NoteEditor({ notes, onSave }: { notes: string | null; onSave: (notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(notes ?? '');
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1 block text-left text-xs text-[var(--color-stone-soft)] hover:text-[var(--color-gold)]">
        {notes ? `Note: ${notes.length > 60 ? notes.slice(0, 60) + '…' : notes}` : '+ Add note'}
      </button>
    );
  }
  return (
    <span className="mt-1 flex items-center gap-1.5">
      <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder="Internal note" className="w-52 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1 text-xs" />
      <button onClick={() => { onSave(val); setOpen(false); }} className="text-xs text-[var(--color-gold)] hover:underline">Save</button>
      <button onClick={() => { setVal(notes ?? ''); setOpen(false); }} className="text-xs text-[var(--color-stone-soft)] hover:underline">Cancel</button>
    </span>
  );
}
