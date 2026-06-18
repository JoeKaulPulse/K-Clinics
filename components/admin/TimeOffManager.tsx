'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/components/i18n/I18nProvider';

type Mine = { id: string; kind: string; status: string; startAt: string; endAt: string; allDay: boolean; reason: string | null; reviewNote?: string | null; reviewedBy?: string | null };
type Pending = { id: string; kind: string; status: string; startAt: string; endAt: string; allDay: boolean; reason: string | null; staffName: string };
type TeamItem = { id: string; staffName: string; kind: string; startAt: string; endAt: string; allDay: boolean };

const KIND_VALUES = ['HOLIDAY', 'SICK', 'TRAINING', 'PERSONAL'];

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-[var(--color-blush)]/20 text-[var(--color-ink)]',
  CANCELLED: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};

const fmtRange = (startAt: string, endAt: string, allDay: boolean) => {
  const s = new Date(startAt), e = new Date(endAt);
  const d = (x: Date) => x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const t = (x: Date) => x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sameDay = s.toDateString() === e.toDateString();
  if (allDay) return sameDay ? `${d(s)} · all day` : `${d(s)} – ${d(e)}`;
  return sameDay ? `${d(s)} · ${t(s)}–${t(e)}` : `${d(s)} ${t(s)} – ${d(e)} ${t(e)}`;
};

async function postTimeOff(payload: object) {
  const res = await fetch('/api/admin/time-off', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.ok !== false, json };
}

export function TimeOffManager({ mine, pending, teamUpcoming, canApprove, requiresApproval }: {
  mine: Mine[]; pending: Pending[]; teamUpcoming: TeamItem[]; canApprove: boolean; requiresApproval: boolean;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-8">
        <RequestForm requiresApproval={requiresApproval} canApprove={canApprove} />
        <MyTimeOff mine={mine} />
      </div>
      <div className="space-y-8">
        {canApprove && <Approvals pending={pending} />}
        {canApprove && <TeamUpcoming items={teamUpcoming} />}
      </div>
    </div>
  );
}

function RequestForm({ requiresApproval, canApprove }: { requiresApproval: boolean; canApprove: boolean }) {
  const router = useRouter();
  const t = useT();
  const [kind, setKind] = useState('HOLIDAY');
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!start || !end) { setMsg('Choose a start and end.'); return; }
    setBusy(true); setMsg('');
    // For all-day, send whole-day boundaries.
    const startAt = allDay ? `${start}T00:00` : start;
    const endAt = allDay ? `${end}T23:59` : end;
    const { ok, json } = await postTimeOff({ op: 'request', kind, startAt, endAt, reason, allDay });
    setBusy(false);
    if (ok) {
      setMsg(json.status === 'PENDING' ? t('timeoff.requested') : t('timeoff.booked'));
      setStart(''); setEnd(''); setReason('');
      router.refresh();
    } else {
      setMsg(json.error || t('common.couldNotSave'));
    }
  }

  const field = 'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]';
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{t('timeoff.request')}</h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{t('common.type')}</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
            {KIND_VALUES.map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />
          {t('timeoff.allDay')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{t('common.from')}</label>
            <input type={allDay ? 'date' : 'datetime-local'} value={start} onChange={(e) => setStart(e.target.value)} className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{t('common.to')}</label>
            <input type={allDay ? 'date' : 'datetime-local'} value={end} onChange={(e) => setEnd(e.target.value)} className={field} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{t('common.reason')} <span className="normal-case text-[var(--color-stone)]">({t('common.optional')})</span></label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-gold)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-60">
            {busy ? t('timeoff.submitting') : requiresApproval && !canApprove ? t('timeoff.request') : t('timeoff.book')}
          </button>
          {msg && <span className="text-sm text-[var(--color-stone)]">{msg}</span>}
        </div>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const t = useT();
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${STATUS_STYLE[status] || 'bg-[var(--color-bone)]'}`}>{t(`status.${status}`)}</span>;
}

function MyTimeOff({ mine }: { mine: Mine[] }) {
  const router = useRouter();
  const t = useT();
  const [busyId, setBusyId] = useState('');

  async function cancel(id: string) {
    setBusyId(id);
    const { ok, json } = await postTimeOff({ op: 'cancel', id });
    setBusyId('');
    if (ok) router.refresh();
    else alert(json?.error || 'Could not cancel this request.');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{t('timeoff.my')}</h2>
      {mine.length === 0 && <p className="text-sm text-[var(--color-stone)]">{t('timeoff.none')}</p>}
      <ul className="divide-y divide-[var(--color-line)]">
        {mine.map((item) => {
          const active = !['DECLINED', 'CANCELLED'].includes(item.status);
          return (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t(`kind.${item.kind}`)}</span>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-0.5 text-sm text-[var(--color-stone)]">{fmtRange(item.startAt, item.endAt, item.allDay)}</p>
                {item.reason && <p className="mt-0.5 text-xs text-[var(--color-stone)]">{item.reason}</p>}
                {item.status === 'DECLINED' && item.reviewNote && <p className="mt-0.5 text-xs text-[var(--color-blush)]">{t('status.DECLINED')}: {item.reviewNote}</p>}
              </div>
              {active && (
                <button onClick={() => cancel(item.id)} disabled={busyId === item.id} className="shrink-0 text-xs text-[var(--color-stone)] hover:text-[var(--color-blush)] disabled:opacity-50">
                  {busyId === item.id ? '…' : t('common.cancel')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Approvals({ pending }: { pending: Pending[] }) {
  const router = useRouter();
  const t = useT();
  const [busyId, setBusyId] = useState('');

  async function decide(id: string, op: 'approve' | 'decline') {
    let note: string | undefined;
    if (op === 'decline') {
      note = window.prompt('Reason for declining (optional, shown to the staff member):') || undefined;
    }
    setBusyId(id);
    const { ok, json } = await postTimeOff({ op, id, note });
    setBusyId('');
    if (ok) router.refresh();
    else alert(json?.error || 'Could not update this request.');
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{t('timeoff.pending')}</h2>
        {pending.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{pending.length}</span>}
      </div>
      {pending.length === 0 && <p className="text-sm text-[var(--color-stone)]">{t('timeoff.noPending')}</p>}
      <ul className="space-y-3">
        {pending.map((item) => (
          <li key={item.id} className="rounded-[var(--radius-sm)] border border-[var(--color-line)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{item.staffName}</span>
              <span className="text-xs text-[var(--color-stone)]">{t(`kind.${item.kind}`)}</span>
            </div>
            <p className="mt-0.5 text-sm text-[var(--color-stone)]">{fmtRange(item.startAt, item.endAt, item.allDay)}</p>
            {item.reason && <p className="mt-0.5 text-xs text-[var(--color-stone)]">{item.reason}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={() => decide(item.id, 'approve')} disabled={busyId === item.id} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{t('timeoff.approve')}</button>
              <button onClick={() => decide(item.id, 'decline')} disabled={busyId === item.id} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs hover:border-[var(--color-blush)] hover:text-[var(--color-blush)] disabled:opacity-50">{t('timeoff.decline')}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TeamUpcoming({ items }: { items: TeamItem[] }) {
  const t = useT();
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl">{t('timeoff.team')}</h2>
      {items.length === 0 && <p className="text-sm text-[var(--color-stone)]">{t('timeoff.noTeam')}</p>}
      <ul className="divide-y divide-[var(--color-line)]">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="font-medium">{item.staffName}</span>
            <span className="text-right text-[var(--color-stone)]">
              <span className="mr-2 rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-xs">{t(`kind.${item.kind}`)}</span>
              {fmtRange(item.startAt, item.endAt, item.allDay)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
