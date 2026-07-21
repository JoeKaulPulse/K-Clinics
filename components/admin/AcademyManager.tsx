'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';

export type Cohort = { id: string; startAt: string; endAt: string | null; accessStartAt: string | null; accessEndAt: string | null; capacity: number; location: string | null; trainer: string | null; name: string | null; status: string };
export type Course = { id: string; slug: string; title: string; level: string | null; summary: string | null; description: string | null; pricePence: number; depositPence: number | null; promoPrice: number | null; promoStartAt: string | null; promoEndAt: string | null; durationText: string | null; format: string | null; accreditations: string[]; outcomes: string[]; prerequisites: string | null; thinkificUrl: string | null; featured: boolean; active: boolean; cohorts: Cohort[] };
export type PaymentRow = { id: string; kind: string; method: string | null; state: string; amountPence: number; dueAt: string | null; paidAt: string | null; note: string | null; recordedBy: string | null };
// feePence is the fee the money engine settles against (the locked agreed fee
// when stamped, BLD-850 — else the list price); pricePence stays the raw
// editable list price behind the £ field.
export type Enrolment = { id: string; courseId: string; courseTitle: string; cohortId: string | null; applicantName: string; applicantEmail: string; applicantPhone: string | null; experience: string | null; financeInterest: boolean; status: string; pricePence: number; feePence: number; paidPence: number; notes: string | null; createdAt: string; studentId: string | null; offeredAt: string | null; offerExpiresAt: string | null; acceptedAt: string | null; paymentPlan: boolean; preCourseAckAt: string | null; payments: PaymentRow[] };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm';
const money = (p: number) => (p > 0 ? `£${(p / 100).toLocaleString('en-GB')}` : '—');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const STATUSES = ['APPLIED', 'OFFERED', 'PAID', 'ENROLLED', 'COMPLETED', 'CANCELLED'];
const PAY_KINDS = ['DEPOSIT', 'BALANCE', 'FULL', 'INSTALMENT'];
const PAY_METHODS = ['CARD', 'BNPL', 'BANK_TRANSFER', 'CASH', 'OTHER'];
const METHOD_LABEL: Record<string, string> = { CARD: 'Card', BNPL: 'Klarna/Clearpay', BANK_TRANSFER: 'Bank transfer', CASH: 'Cash', OTHER: 'Other' };
const STATE_BADGE: Record<string, string> = { PAID: 'bg-emerald-100 text-emerald-800', SCHEDULED: 'bg-[var(--color-line)] text-[var(--color-stone)]', PENDING: 'bg-amber-100 text-amber-800', FAILED: 'bg-red-100 text-red-800', REFUNDED: 'bg-[var(--color-line)] text-[var(--color-stone)]', CANCELLED: 'bg-[var(--color-line)] text-[var(--color-stone)]' };

async function post(payload: object) {
  return fetch('/api/admin/academy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export function Applications({ enrolments, courses }: { enrolments: Enrolment[]; courses: Course[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  async function act(payload: object) {
    const r = await post(payload);
    const j = await r.json().catch(() => null);
    if (j && j.ok === false && j.error) { alert(j.error); return; }
    router.refresh();
  }
  const cohortsFor = (courseId: string) => courses.find((c) => c.id === courseId)?.cohorts ?? [];

  const shown = filter ? enrolments.filter((e) => e.status === filter) : enrolments;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Applications &amp; enrolments</h2>
      <p className="mb-3 text-sm text-[var(--color-stone)]">Review applicants, <strong>make an offer</strong> (emails them a one-click accept &amp; pay link), then take payment online or record it manually. Open <em>Payments</em> on a row to add a payment or set up an instalment plan.</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {['', ...STATUSES].map((s) => (
          <button key={s || 'all'} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs ${filter === s ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border border-[var(--color-line)] hover:border-[var(--color-gold)]'}`}>
            {s || 'All'} {s ? `(${enrolments.filter((e) => e.status === s).length})` : `(${enrolments.length})`}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-[var(--color-stone)]">No {filter ? `${filter.toLowerCase()} ` : ''}applications.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
              <th scope="col" className="py-1 pr-2">Applicant</th><th scope="col" className="px-2">Course</th><th scope="col" className="px-2">Status</th><th scope="col" className="px-2">Cohort</th><th scope="col" className="px-2">Money</th><th scope="col" className="px-2 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {shown.map((e) => {
                const outstanding = Math.max(0, e.feePence - e.paidPence);
                const isOpen = open === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr className="border-t border-[var(--color-line)] align-top">
                      <td className="py-2 pr-2">
                        <span className="font-medium">{e.applicantName}</span>
                        {e.financeInterest && <span className="ml-1 rounded-full bg-[var(--color-gold)]/15 px-1.5 py-0.5 text-[0.6rem] text-[var(--color-gold-deep)]">Finance</span>}
                        {!e.studentId && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.6rem] text-amber-800" title="No trainee account linked yet — make an offer to create one">No account</span>}
                        <span className="block text-xs text-[var(--color-stone)]">{e.applicantEmail}{e.applicantPhone ? ` · ${e.applicantPhone}` : ''}</span>
                        <span className="block text-xs text-[var(--color-stone)]">Applied {fmtDate(e.createdAt)}{e.preCourseAckAt ? ' · pre-course read ✓' : ''}</span>
                        {e.experience && <span className="mt-1 block max-w-xs text-xs text-[var(--color-stone)]">{e.experience}</span>}
                      </td>
                      <td className="px-2">{e.courseTitle}</td>
                      <td className="px-2">
                        <select
                          value={e.status}
                          onChange={(ev) => {
                            const next = ev.target.value;
                            // BLD-764: cancelling does not itself refund a paid fee (use the
                            // Refund button below, per payment, for that) -- unlike every
                            // other destructive action here this dropdown had no confirm().
                            if (next === 'CANCELLED' && !confirm(e.paidPence > 0
                              ? `Cancel this enrolment? £${(e.paidPence / 100).toFixed(2)} already paid will NOT be refunded automatically -- use the Refund button on the payment below if one is owed.`
                              : 'Cancel this enrolment?')) return;
                            act({ op: 'updateEnrolment', id: e.id, status: next });
                          }}
                          className={field}
                          aria-label="Status"
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {e.offeredAt && <span className="mt-1 block text-[0.65rem] text-[var(--color-stone)]">Offered {fmtDate(e.offeredAt)}</span>}
                      </td>
                      <td className="px-2">
                        <select value={e.cohortId ?? ''} onChange={(ev) => act({ op: 'updateEnrolment', id: e.id, cohortId: ev.target.value })} className={field} aria-label="Cohort">
                          <option value="">—</option>
                          {cohortsFor(e.courseId).map((h) => <option key={h.id} value={h.id}>{h.name || fmtDate(h.startAt)}</option>)}
                        </select>
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        <span className="font-medium">{money(e.paidPence)}</span><span className="text-[var(--color-stone)]"> / {money(e.feePence)}</span>
                        {outstanding > 0 && <span className="block text-[0.65rem] text-[var(--color-stone)]">{money(outstanding)} due{e.paymentPlan ? ' · plan' : ''}</span>}
                      </td>
                      <td className="px-2 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {(e.status === 'APPLIED' || e.status === 'OFFERED') && (
                            <button onClick={() => { if (confirm(`Email ${e.applicantName} an offer with a one-click accept & pay link?`)) act({ op: 'makeOffer', id: e.id, expiresInDays: 14 }); }} className="rounded-full bg-[var(--color-gold-deep)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-ink)]">
                              {e.status === 'OFFERED' ? 'Resend offer' : 'Make offer'}
                            </button>
                          )}
                          <button onClick={() => setOpen(isOpen ? null : e.id)} className="text-xs text-[var(--color-gold-deep)] hover:underline">{isOpen ? 'Close' : 'Payments'} ({e.payments.length})</button>
                          <button onClick={() => { if (confirm('Remove this application?')) act({ op: 'removeEnrolment', id: e.id }); }} className="text-xs text-[var(--color-blush-deep)] hover:underline">Remove</button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-[var(--color-line)] bg-white/60">
                        <td colSpan={6} className="p-4"><PaymentPanel enrolment={e} onAct={act} /></td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// BLD-528: staff manually add a learner to a course (creates/links the trainee
// account by email). Answers "I can't manually add students to courses."
export function EnrolStudent({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ courseId: '', cohortId: '', email: '', name: '', status: 'ENROLLED', sendLink: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const cohorts = courses.find((c) => c.id === f.courseId)?.cohorts ?? [];

  async function submit() {
    setMsg('');
    if (!f.courseId || !f.email.trim()) { setMsg('Pick a course and enter an email.'); return; }
    setBusy(true);
    const res = await post({ op: 'enrolStudent', courseId: f.courseId, cohortId: f.cohortId || undefined, email: f.email.trim(), name: f.name.trim() || undefined, status: f.status, sendLink: f.sendLink });
    const j = await res.json().catch(() => ({ ok: false }));
    setBusy(false);
    if (j.ok) { setMsg('Added ✓'); setF({ courseId: '', cohortId: '', email: '', name: '', status: 'ENROLLED', sendLink: true }); router.refresh(); setTimeout(() => setMsg(''), 4000); }
    else setMsg(j.error || 'Could not add the student.');
  }

  return (
    <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl">Add a student to a course</h2>
          <p className="text-sm text-[var(--color-stone)]">Enrol someone directly (e.g. they paid offline or signed up in person). Creates their trainee account if they don’t have one.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{open ? 'Close' : '+ Add student'}</button>
      </div>
      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[var(--color-stone)]">Course<br />
            <select value={f.courseId} onChange={(e) => { set('courseId', e.target.value); set('cohortId', ''); }} className={`${field} w-full`}>
              <option value="">— choose a course —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="block text-xs text-[var(--color-stone)]">Cohort (optional)<br />
            <select value={f.cohortId} onChange={(e) => set('cohortId', e.target.value)} className={`${field} w-full`} disabled={!f.courseId}>
              <option value="">— no cohort yet —</option>
              {cohorts.map((h) => <option key={h.id} value={h.id}>{h.name || fmtDate(h.startAt)}</option>)}
            </select>
          </label>
          <label className="block text-xs text-[var(--color-stone)]">Student email<br /><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={`${field} w-full`} placeholder="name@example.com" /></label>
          <label className="block text-xs text-[var(--color-stone)]">Student name (optional)<br /><input value={f.name} onChange={(e) => set('name', e.target.value)} className={`${field} w-full`} placeholder="First Last" /></label>
          <label className="block text-xs text-[var(--color-stone)]">Status<br />
            <select value={f.status} onChange={(e) => set('status', e.target.value)} className={`${field} w-full`}>
              <option value="ENROLLED">Enrolled (access on now)</option>
              <option value="PAID">Paid (access on now)</option>
              <option value="OFFERED">Offered (no access yet)</option>
              <option value="APPLIED">Applied (no access yet)</option>
            </select>
          </label>
          <label className="flex items-end gap-2 text-sm text-[var(--color-stone)]"><input type="checkbox" checked={f.sendLink} onChange={(e) => set('sendLink', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />Email them a one-click portal link</label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button onClick={submit} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Adding…' : 'Add to course'}</button>
            {msg && <span className={`text-sm ${msg.includes('✓') ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-blush-deep)]'}`}>{msg}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function PaymentPanel({ enrolment: e, onAct }: { enrolment: Enrolment; onAct: (p: object) => Promise<void> }) {
  const outstanding = Math.max(0, e.feePence - e.paidPence);
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding / 100) : '');
  const [kind, setKind] = useState('BALANCE');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [note, setNote] = useState('');
  const [planCount, setPlanCount] = useState('3');
  const [planStart, setPlanStart] = useState('');
  const [busy, setBusy] = useState(false);

  async function record() {
    const pence = Math.round(Number(amount || 0) * 100);
    if (pence <= 0) return;
    setBusy(true);
    await onAct({ op: 'recordPayment', id: e.id, amountPence: pence, kind, method, note: note || undefined });
    setBusy(false); setNote('');
  }
  async function plan() {
    if (!planStart) return;
    setBusy(true);
    await onAct({ op: 'createPlan', id: e.id, count: Number(planCount) || 3, startDate: planStart });
    setBusy(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Payment history &amp; schedule</h4>
        {e.payments.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-stone)]">No payments yet. Make an offer so the learner can pay online, or record a payment / set up a plan below.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {e.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{money(p.amountPence)}</span>
                  <span className="text-[var(--color-stone)]"> · {p.kind.toLowerCase()}{p.method ? ` · ${METHOD_LABEL[p.method] ?? p.method}` : ''}</span>
                  <span className="block text-[0.65rem] text-[var(--color-stone)]">
                    {p.state === 'PAID' && p.paidAt ? `Paid ${fmtDate(p.paidAt)}` : p.dueAt ? `Due ${fmtDate(p.dueAt)}` : ''}{p.recordedBy ? ` · ${p.recordedBy}` : ''}{p.note ? ` · ${p.note}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${STATE_BADGE[p.state] ?? STATE_BADGE.SCHEDULED}`}>{p.state}</span>
                  {p.state !== 'PAID' && <button onClick={() => onAct({ op: 'markPaymentPaid', paymentId: p.id, method: p.method || 'BANK_TRANSFER' })} className="text-xs text-[var(--color-gold-deep)] hover:underline">Mark paid</button>}
                  {p.state === 'PAID' && <button onClick={() => { if (confirm('Issue a Stripe refund for this payment?')) onAct({ op: 'refundPayment', paymentId: p.id }); }} className="text-xs text-[var(--color-stone-soft)] hover:underline">Refund</button>}
                  <button onClick={() => { if (confirm('Remove this payment row?')) onAct({ op: 'removePayment', paymentId: p.id }); }} aria-label="Remove payment" className="text-xs text-[var(--color-blush-deep)] hover:underline">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {e.acceptedAt && <p className="mt-2 text-[0.65rem] text-[var(--color-stone)]">Accepted {fmtDate(e.acceptedAt)}</p>}
      </div>
      <div className="space-y-4">
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Agreed course fee</p>
          <label className="text-[0.6rem] text-[var(--color-stone)]">£<input type="number" defaultValue={e.pricePence ? e.pricePence / 100 : ''} onBlur={(ev) => { const v = Math.round(Number(ev.target.value || 0) * 100); if (v !== e.pricePence) onAct({ op: 'updateEnrolment', id: e.id, pricePence: v }); }} className={`${field} ml-1 w-24`} /></label>
          <p className="mt-1 text-[0.65rem] text-[var(--color-stone)]">What this learner pays in total. Edit to apply a discount or bursary.</p>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Record a payment</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[0.6rem] text-[var(--color-stone)]">£<input value={amount} onChange={(ev) => setAmount(ev.target.value)} className={`${field} w-20`} placeholder="0.00" /></label>
            <label className="text-[0.6rem] text-[var(--color-stone)]">Type<select value={kind} onChange={(ev) => setKind(ev.target.value)} className={field}>{PAY_KINDS.map((k) => <option key={k} value={k}>{k.toLowerCase()}</option>)}</select></label>
            <label className="text-[0.6rem] text-[var(--color-stone)]">Method<select value={method} onChange={(ev) => setMethod(ev.target.value)} className={field}>{PAY_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></label>
          </div>
          <input value={note} onChange={(ev) => setNote(ev.target.value)} className={`${field} mt-2 w-full`} placeholder="Note (optional)" />
          <button onClick={record} disabled={busy} className="mt-2 rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{busy ? '…' : 'Record payment'}</button>
        </div>
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Instalment plan</p>
          <p className="mb-2 text-[0.65rem] text-[var(--color-stone)]">Splits the {money(outstanding)} balance into monthly payments you collect and mark paid.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[0.6rem] text-[var(--color-stone)]">Months<input value={planCount} onChange={(ev) => setPlanCount(ev.target.value)} className={`${field} w-16`} /></label>
            <label className="text-[0.6rem] text-[var(--color-stone)]">First due<input type="date" value={planStart} onChange={(ev) => setPlanStart(ev.target.value)} className={field} /></label>
            <button onClick={plan} disabled={busy || !planStart} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs text-[var(--color-porcelain)] disabled:opacity-50">{busy ? '…' : 'Create plan'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Courses({ courses, enrolments }: { courses: Course[]; enrolments?: Enrolment[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Courses</h2>
        <button onClick={() => setAdding((v) => !v)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{adding ? 'Close' : '+ New course'}</button>
      </div>
      {adding && <CourseForm onDone={() => setAdding(false)} />}
      <div className="mt-4 space-y-4">
        {courses.map((c) => <CourseCard key={c.id} course={c} enrolments={(enrolments ?? []).filter((e) => e.courseId === c.id)} />)}
      </div>
    </section>
  );
}

function CourseCard({ course, enrolments }: { course: Course; enrolments: Enrolment[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  async function act(payload: object) { await post(payload); router.refresh(); }
  return (
    <div className={`rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4 ${course.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-medium">{course.title}</span>
          <span className="text-xs text-[var(--color-stone)]"> · {course.level || 'No level'} · {money(course.pricePence)} · {course.cohorts.length} cohort(s){course.featured ? ' · featured' : ''}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href={`/admin/academy/${course.id}`} className="font-medium text-[var(--color-ink)] hover:text-[var(--color-gold-deep)] hover:underline">Curriculum →</a>
          <button onClick={() => setEditing((v) => !v)} className="text-[var(--color-gold-deep)] hover:underline">{editing ? 'Close' : 'Edit'}</button>
          <button onClick={() => act({ op: 'toggleCourse', id: course.id, active: !course.active })} className="text-[var(--color-stone)] hover:underline">{course.active ? 'Disable' : 'Enable'}</button>
          <button onClick={() => { if (confirm('Delete this course and its cohorts?')) act({ op: 'removeCourse', id: course.id }); }} className="text-[var(--color-blush-deep)] hover:underline">Delete</button>
        </div>
      </div>
      {editing && <div className="mt-4"><CourseForm course={course} onDone={() => setEditing(false)} /></div>}
      <Cohorts course={course} enrolments={enrolments} />
    </div>
  );
}

function CourseForm({ course, onDone }: { course?: Course; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    title: course?.title ?? '', level: course?.level ?? '', summary: course?.summary ?? '', description: course?.description ?? '',
    price: course ? String(course.pricePence / 100) : '', deposit: course?.depositPence ? String(course.depositPence / 100) : '',
    promoPrice: course?.promoPrice ? String(course.promoPrice / 100) : '',
    promoStartAt: course?.promoStartAt ? course.promoStartAt.slice(0, 10) : '',
    promoEndAt: course?.promoEndAt ? course.promoEndAt.slice(0, 10) : '',
    durationText: course?.durationText ?? '', format: course?.format ?? '', accreditations: (course?.accreditations ?? []).join(', '),
    outcomes: (course?.outcomes ?? []).join('\n'), prerequisites: course?.prerequisites ?? '', thinkificUrl: course?.thinkificUrl ?? '',
    featured: course?.featured ?? false,
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    await post({
      op: 'upsertCourse', id: course?.id, title: f.title, level: f.level, summary: f.summary, description: f.description,
      pricePence: Math.round(Number(f.price || 0) * 100), depositPence: f.deposit ? Math.round(Number(f.deposit) * 100) : null,
      promoPrice: f.promoPrice ? Math.round(Number(f.promoPrice) * 100) : null,
      promoStartAt: f.promoStartAt || null,
      promoEndAt: f.promoEndAt || null,
      durationText: f.durationText, format: f.format, accreditations: f.accreditations.split(','), outcomes: f.outcomes.split('\n'),
      prerequisites: f.prerequisites, thinkificUrl: f.thinkificUrl, featured: f.featured, active: course?.active ?? true,
    });
    setBusy(false); onDone(); router.refresh();
  }

  const L = (label: string, el: React.ReactNode) => <label className="block text-xs text-[var(--color-stone)]">{label}<br />{el}</label>;
  return (
    <div className="grid gap-3 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 sm:grid-cols-2">
      {L('Title', <input value={f.title} onChange={(e) => set('title', e.target.value)} className={`${field} w-full`} />)}
      {L('Level', <input value={f.level} onChange={(e) => set('level', e.target.value)} placeholder="Level 4" className={`${field} w-full`} />)}
      {L('Price £', <input value={f.price} onChange={(e) => set('price', e.target.value)} className={`${field} w-full`} />)}
      {L('Deposit £ (optional)', <input value={f.deposit} onChange={(e) => set('deposit', e.target.value)} className={`${field} w-full`} />)}
      {L('Promo price £ (optional)', <input value={f.promoPrice} onChange={(e) => set('promoPrice', e.target.value)} placeholder="Leave blank to disable" className={`${field} w-full`} />)}
      {L('Promo starts (optional, blank = immediate)', <input type="date" value={f.promoStartAt} onChange={(e) => set('promoStartAt', e.target.value)} className={`${field} w-full`} />)}
      {L('Promo ends (optional, blank = never)', <input type="date" value={f.promoEndAt} onChange={(e) => set('promoEndAt', e.target.value)} className={`${field} w-full`} />)}
      <div className="sm:col-span-2">{L('Summary (card one-liner)', <input value={f.summary} onChange={(e) => set('summary', e.target.value)} className={`${field} w-full`} />)}</div>
      <div className="sm:col-span-2">{L('Description', <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${field} w-full`} />)}</div>
      {L('Duration text', <input value={f.durationText} onChange={(e) => set('durationText', e.target.value)} placeholder="2 practical days + theory + exam" className={`${field} w-full`} />)}
      {L('Format', <input value={f.format} onChange={(e) => set('format', e.target.value)} placeholder="Blended" className={`${field} w-full`} />)}
      {L('Accreditations (comma)', <input value={f.accreditations} onChange={(e) => set('accreditations', e.target.value)} placeholder="OFQUAL, VTCT, CPD" className={`${field} w-full`} />)}
      {L('Thinkific URL', <input value={f.thinkificUrl} onChange={(e) => set('thinkificUrl', e.target.value)} className={`${field} w-full`} />)}
      <div className="sm:col-span-2">{L('Learning outcomes (one per line)', <textarea value={f.outcomes} onChange={(e) => set('outcomes', e.target.value)} rows={3} className={`${field} w-full`} />)}</div>
      <div className="sm:col-span-2">{L('Prerequisites', <input value={f.prerequisites} onChange={(e) => set('prerequisites', e.target.value)} className={`${field} w-full`} />)}</div>
      <label className="flex items-center gap-2 text-sm text-[var(--color-stone)]"><input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} className="h-4 w-4 accent-[var(--color-gold)]" />Featured</label>
      <div className="sm:col-span-2"><button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-60">{busy ? 'Saving…' : 'Save course'}</button></div>
    </div>
  );
}

function Cohorts({ course, enrolments }: { course: Course; enrolments: Enrolment[] }) {
  const router = useRouter();
  const [add, setAdd] = useState(false);
  const [c, setC] = useState({ name: '', startAt: '', endAt: '', accessStartAt: '', accessEndAt: '', capacity: '8', location: 'Islington', trainer: '' });
  async function act(payload: object) { await post(payload); router.refresh(); }
  async function save() {
    if (!c.startAt) return;
    await post({ op: 'upsertCohort', courseId: course.id, name: c.name || null, startAt: c.startAt, endAt: c.endAt || null, accessStartAt: c.accessStartAt || null, accessEndAt: c.accessEndAt || null, capacity: Number(c.capacity), location: c.location, trainer: c.trainer });
    setAdd(false); setC({ name: '', startAt: '', endAt: '', accessStartAt: '', accessEndAt: '', capacity: '8', location: 'Islington', trainer: '' }); router.refresh();
  }
  return (
    <div className="mt-3 border-t border-[var(--color-line)] pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Cohorts — practical dates &amp; course-access window</p>
        <button onClick={() => setAdd((v) => !v)} className="text-xs text-[var(--color-gold-deep)] hover:underline">{add ? 'Cancel' : '+ Add cohort'}</button>
      </div>
      {add && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={`${field} w-44`} placeholder="Cohort name (e.g. Sep 2026)" />
          <label className="text-[0.6rem] text-[var(--color-stone)]">Practical from<input type="date" value={c.startAt} onChange={(e) => setC({ ...c, startAt: e.target.value })} className={field} /></label>
          <label className="text-[0.6rem] text-[var(--color-stone)]">to<input type="date" value={c.endAt} onChange={(e) => setC({ ...c, endAt: e.target.value })} className={field} /></label>
          <label className="text-[0.6rem] text-[var(--color-stone)]">Access opens<input type="date" value={c.accessStartAt} onChange={(e) => setC({ ...c, accessStartAt: e.target.value })} className={field} /></label>
          <label className="text-[0.6rem] text-[var(--color-stone)]">Access expires<input type="date" value={c.accessEndAt} onChange={(e) => setC({ ...c, accessEndAt: e.target.value })} className={field} /></label>
          <input value={c.capacity} onChange={(e) => setC({ ...c, capacity: e.target.value })} className={`${field} w-16`} placeholder="cap" />
          <input value={c.trainer} onChange={(e) => setC({ ...c, trainer: e.target.value })} className={`${field} w-32`} placeholder="trainer" />
          <button onClick={save} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-xs text-[var(--color-porcelain)]">Add</button>
        </div>
      )}
      {course.cohorts.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm">
          {course.cohorts.map((h) => <CohortRow key={h.id} courseId={course.id} cohort={h} enrolments={enrolments.filter((e) => e.cohortId === h.id)} onRemove={() => { if (confirm('Remove cohort?')) act({ op: 'removeCohort', id: h.id }); }} />)}
        </ul>
      )}
    </div>
  );
}

function CohortRow({ courseId, cohort: h, enrolments, onRemove }: { courseId: string; cohort: Cohort; enrolments: Enrolment[]; onRemove: () => void }) {
  const router = useRouter();
  const init = (d: string | null) => (d ? d.slice(0, 10) : '');
  const [aStart, setAStart] = useState(init(h.accessStartAt));
  const [aEnd, setAEnd] = useState(init(h.accessEndAt));
  const [name, setName] = useState(h.name ?? '');
  const [busy, setBusy] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const dirtyAccess = aStart !== init(h.accessStartAt) || aEnd !== init(h.accessEndAt);
  const dirtyName = name !== (h.name ?? '');
  const dirty = dirtyAccess || dirtyName;
  async function act(payload: object) { await post(payload); router.refresh(); }
  async function saveAccess() {
    setBusy(true);
    await post({ op: 'upsertCohort', id: h.id, courseId, name: name || null, startAt: h.startAt, endAt: h.endAt, accessStartAt: aStart || null, accessEndAt: aEnd || null, capacity: h.capacity, location: h.location, trainer: h.trainer, status: h.status });
    setBusy(false); router.refresh();
  }
  return (
    <li className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-44`} placeholder={fmtDate(h.startAt)} title="Cohort name" />
        <span className="text-[var(--color-ink-soft)]">{fmtDate(h.startAt)}{h.endAt ? `–${fmtDate(h.endAt)}` : ''} · {h.capacity} places{h.trainer ? ` · ${h.trainer}` : ''} · {h.status}</span>
        <label className="text-[0.6rem] text-[var(--color-stone)]" title="Course access opens">access<input type="date" value={aStart} onChange={(e) => setAStart(e.target.value)} className={`${field} ml-1`} /></label>
        <span className="text-[var(--color-stone)]">→</span>
        <input type="date" value={aEnd} onChange={(e) => setAEnd(e.target.value)} className={field} title="Course access expires" />
        {dirty && <button onClick={saveAccess} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-2.5 py-1 text-[0.65rem] text-[var(--color-porcelain)] disabled:opacity-50">{busy ? '…' : 'Save'}</button>}
        <button onClick={() => setShowStudents((v) => !v)} className="text-xs text-[var(--color-gold-deep)] hover:underline">{enrolments.length} student{enrolments.length !== 1 ? 's' : ''}</button>
        <button onClick={onRemove} className="text-xs text-[var(--color-blush-deep)] hover:underline">Remove</button>
      </div>
      {showStudents && (
        <div className="mt-2 border-t border-[var(--color-line)] pt-2">
          {enrolments.length === 0 ? (
            <p className="text-xs text-[var(--color-stone)]">No students assigned to this cohort.</p>
          ) : (
            <ul className="space-y-1">
              {enrolments.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>{e.applicantName} · {e.applicantEmail} · {e.status}</span>
                  <button onClick={() => act({ op: 'updateEnrolment', id: e.id, cohortId: '' })} className="shrink-0 text-[var(--color-stone)] hover:text-[var(--color-blush-deep)] hover:underline">Remove from cohort</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
