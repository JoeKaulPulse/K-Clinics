import Link from 'next/link';
import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, canViewClinical, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { AddNote, PinToggle, SendEmail, StatusSelect } from '@/components/admin/ClientActions';
import { DiscountAction } from '@/components/admin/DiscountActions';
import { AdjustClientPoints } from '@/components/admin/AdjustClientPoints';

// Visual styling per interaction type for the client timeline.
const NOTE_STYLE: Record<string, { label: string; dot: string; badge: string }> = {
  NOTE: { label: 'Note', dot: 'bg-[var(--color-gold)]', badge: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
  CLINICAL: { label: 'Clinical', dot: 'bg-[var(--color-ink)]', badge: 'bg-[var(--color-ink)] text-[var(--color-gold-soft)]' },
  COMPLAINT: { label: 'Complaint', dot: 'bg-[var(--color-blush)]', badge: 'bg-[var(--color-blush)]/20 text-[var(--color-ink)]' },
  FOLLOW_UP: { label: 'Follow-up', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800' },
  CALL: { label: 'Call', dot: 'bg-sky-400', badge: 'bg-sky-100 text-sky-800' },
  EMAIL: { label: 'Email', dot: 'bg-[var(--color-stone-soft)]', badge: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
  SMS: { label: 'SMS', dot: 'bg-[var(--color-stone-soft)]', badge: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
  APPOINTMENT: { label: 'Appointment', dot: 'bg-green-400', badge: 'bg-green-100 text-green-800' },
  SYSTEM: { label: 'System', dot: 'bg-[var(--color-line)]', badge: 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]' },
};
const noteStyle = (t: string) => NOTE_STYLE[t] ?? NOTE_STYLE.NOTE;

const GENDER_LABEL: Record<string, string> = {
  FEMALE: 'Female', MALE: 'Male', NON_BINARY: 'Non-binary', OTHER: 'Other', PREFER_NOT_TO_SAY: 'Prefer not to say',
};
const genderLabel = (g: string, selfDescribe?: string | null) =>
  g === 'OTHER' && selfDescribe ? selfDescribe : (GENDER_LABEL[g] ?? g);
import { MedicalFlagEditor } from '@/components/admin/MedicalFlagEditor';
import { ClientTasks } from '@/components/admin/ClientTasks';
import { DataPrivacy } from '@/components/admin/DataPrivacy';
import { sessionCan } from '@/lib/auth';
import { fmtClinicTime, fmtClinicDate } from '@/lib/clinic-time';

const BK_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-[color-mix(in_oklab,var(--color-jade)_14%,transparent)] text-[var(--color-jade)]',
  COMPLETED: 'bg-[var(--color-ink)] text-[var(--color-porcelain)]',
  CANCELLED: 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]',
  NO_SHOW: 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]',
};

export const dynamic = 'force-dynamic';

// Tidy legacy consultation text imported from the old WordPress contact form,
// which stored slashes as numeric HTML entities (&#047;) and other encoded
// characters. Output is rendered as plain text (React escapes it), so this is
// display-only and safe.
function tidyConsultText(s: string): string {
  return s
    .replace(/&#0*47;/g, '/')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(Number(n)); } catch { return _; } })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
    .trim();
}

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { id } = await params;
  const { getClient } = await import('@/lib/crm-data');
  const session = await getSession();
  const c = await getClient(id);
  if (!c) notFound();

  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');

  // Clinical (health) data — practitioners/admins/owner only. Decrypt the latest
  // version of each assessment type for display.
  const clinical = canViewClinical(session?.role);
  const clinicalAssessments: { title: string; version: number; submittedAt: Date; tampered: boolean; sourceLocale?: string; translatedNote?: string | null; items: { id: string; prompt: string; value: string; original?: string }[] }[] = [];
  if (clinical && c.assessments.length) {
    const seen = new Set<string>();
    const latest = c.assessments.filter((a) => (seen.has(a.type) ? false : (seen.add(a.type), true)));
    const { formatAssessment } = await import('@/lib/health-assessments');
    for (const a of latest) {
      const f = await formatAssessment(a.id);
      if (f) clinicalAssessments.push(f);
    }
  }

  const can = await sessionPermissions();

  // Appointments + per-client activity log. Consent state is summarised per
  // booking (signed treatment consent on file?) so the team can drill back
  // through a client's history from one place.
  const bookingIds = c.bookings.map((b) => b.id);
  const { db: dbc } = await import('@/lib/db');
  const [consentRows, auditRows] = await Promise.all([
    bookingIds.length
      ? dbc.signedConsent.findMany({ where: { bookingId: { in: bookingIds }, kind: 'treatment', declined: false }, select: { bookingId: true } }).catch(() => [])
      : Promise.resolve([]),
    dbc.auditEvent.findMany({ where: { clientId: c.id }, orderBy: { createdAt: 'desc' }, take: 18, select: { id: true, action: true, actor: true, actorRole: true, summary: true, createdAt: true } }).catch(() => []),
  ]);
  const consentSet = new Set(consentRows.map((r) => r.bookingId));
  const nowTs = new Date();
  const inProgress = c.bookings.filter((b) => b.startedAt && !b.finishedAt);
  const upcoming = c.bookings
    .filter((b) => !(b.startedAt && !b.finishedAt) && b.startAt >= nowTs && (b.status === 'PENDING' || b.status === 'CONFIRMED'))
    .sort((a, b) => +a.startAt - +b.startAt);
  const pastBookings = c.bookings.filter((b) => !inProgress.includes(b) && !upcoming.includes(b)); // already desc by startAt

  // K Vision AI consultations (clinical — decrypt findings + photos for the clinician).
  const aiAnalyses: { id: string; createdAt: Date; summary: string | null; treatments: string[]; findings: { label: string; note: string; severity: string }[]; images: string[] }[] = [];
  if (clinical) {
    try {
      const { db } = await import('@/lib/db');
      const { decryptJson } = await import('@/lib/crypto');
      const rows = await db.aiAnalysis.findMany({ where: { clientId: c.id, status: 'complete' }, orderBy: { createdAt: 'desc' }, take: 5, include: { images: true } });
      for (const r of rows) {
        let findings: { label: string; note: string; severity: string }[] = [];
        try { findings = r.findingsEnc ? decryptJson(r.findingsEnc) : []; } catch { /* skip */ }
        const images: string[] = [];
        for (const im of r.images) { try { images.push(decryptJson<string>(im.dataEnc)); } catch { /* skip */ } }
        // planJson shape: { phases: [{ treatments: [{ title }] }], extras, planTotalPence }
        const plan = (r.planJson as { phases?: { treatments?: { title?: string }[] }[] }) ?? {};
        const treatments = (plan.phases ?? []).flatMap((p) => (p.treatments ?? []).map((t) => t.title || '').filter(Boolean));
        aiAnalyses.push({ id: r.id, createdAt: r.createdAt, summary: r.summary, treatments, findings, images });
      }
    } catch { /* AI section is best-effort */ }
  }

  // Accountability (UK GDPR Art. 5(2) / Art. 32): record WHO viewed WHOSE clinical
  // data whenever health/AI content was actually decrypted for display — not just
  // on SAR export. No clinical content is placed in the summary.
  if (clinical && (clinicalAssessments.length > 0 || aiAnalyses.length > 0)) {
    try {
      const { logAudit } = await import('@/lib/audit');
      await logAudit({ action: 'ASSESSMENT_VIEWED', actor: session?.email || 'unknown', actorRole: session?.role, clientId: id, summary: 'Clinical record viewed (health/AI data decrypted for display)' });
    } catch { /* audit is best-effort — never block the page */ }
  }

  // Loyalty snapshot (balance + recent ledger). Best-effort — never blocks the page.
  const { clientLoyaltySummary, clientLedger, pointsToPence } = await import('@/lib/client-loyalty');
  const { formatPrice } = await import('@/lib/treatments');
  let loyalty: Awaited<ReturnType<typeof clientLoyaltySummary>> | null = null;
  let loyaltyLedger: Awaited<ReturnType<typeof clientLedger>> = [];
  try {
    [loyalty, loyaltyLedger] = await Promise.all([clientLoyaltySummary(c.id), clientLedger(c.id, 8)]);
  } catch { /* loyalty optional */ }
  const canManageLoyalty = can.includes('discounts.manage');

  return (
    <AdminShell user={session?.email} can={can}>
      <Link href="/admin/clients" className="text-sm text-[var(--color-gold)] hover:underline">← Clients</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{fullName}</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">
            {c.email}{c.phone ? ` · ${c.phone}` : ''}
            {c.dob ? ` · DOB ${new Date(c.dob).toLocaleDateString('en-GB')}` : ''}
            {c.gender ? ` · ${genderLabel(c.gender, c.genderSelfDescribe)}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.source && <span className="rounded-full bg-[var(--color-bone)] px-2.5 py-0.5 text-xs text-[var(--color-stone)]">{c.source}</span>}
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${c.marketingOptIn && !c.unsubscribed ? 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>
              {c.unsubscribed ? 'unsubscribed' : c.marketingOptIn ? 'marketing opt-in' : 'no marketing'}
            </span>
          </div>
        </div>
        {sessionCan(session, 'clients.edit') && <SendEmail clientId={c.id} email={c.email} />}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-10">
        {/* Appointments — past / current / upcoming, with consent + insights */}
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Appointments</h2>
          {(() => {
            const fmtPence = (p: number) => formatPrice(p);
            const Row = ({ b }: { b: (typeof c.bookings)[number] }) => {
              const cancelled = b.status === 'CANCELLED' || b.status === 'NO_SHOW';
              const consentOk = consentSet.has(b.id);
              return (
                <Link href={`/admin/bookings/${b.id}`} className="block rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3.5 transition-colors hover:border-[var(--color-gold)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{b.treatmentTitle}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-stone)]">
                        {fmtClinicDate(b.startAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {fmtClinicTime(b.startAt)}
                        {b.pricePence > 0 ? ` · ${fmtPence(b.pricePence)}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${BK_BADGE[b.status] ?? 'bg-[var(--color-bone)]'}`}>{b.status.toLowerCase().replace('_', ' ')}</span>
                  </div>
                  {/* Per-appointment insights */}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[0.65rem]">
                    {b.arrivedAt && !b.finishedAt && <span className="rounded-full bg-[color-mix(in_oklab,var(--color-jade)_14%,transparent)] px-2 py-0.5 text-[var(--color-jade)]">✓ Arrived</span>}
                    {b.startedAt && !b.finishedAt && <span className="rounded-full bg-[color-mix(in_oklab,var(--color-jade)_14%,transparent)] px-2 py-0.5 text-[var(--color-jade)]">In progress</span>}
                    {!cancelled && (
                      <span className={`rounded-full px-2 py-0.5 ${consentOk ? 'bg-[var(--color-bone)] text-[var(--color-stone)]' : 'bg-amber-100 text-amber-800'}`}>{consentOk ? 'Consent on file' : 'Consent outstanding'}</span>
                    )}
                    {b.status === 'COMPLETED' && b.actualMinutes != null && (
                      <span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[var(--color-stone)]">{b.actualMinutes}m actual{b.durationMin ? ` · ${b.durationMin}m booked` : ''}</span>
                    )}
                    {b.status === 'COMPLETED' && b.pricePence > 0 && (
                      <span className={`rounded-full px-2 py-0.5 ${b.chargedAt ? 'bg-[var(--color-bone)] text-[var(--color-stone)]' : 'bg-amber-100 text-amber-800'}`}>{b.chargedAt ? 'Charged' : 'Not charged'}</span>
                    )}
                  </div>
                </Link>
              );
            };
            const Group = ({ title, items, accent }: { title: string; items: typeof c.bookings; accent?: boolean }) =>
              items.length === 0 ? null : (
                <div>
                  <p className={`mb-2 text-xs font-semibold uppercase tracking-[0.12em] ${accent ? 'text-[var(--color-gold-deep)]' : 'text-[var(--color-stone-soft)]'}`}>{title}</p>
                  <div className="space-y-2">{items.map((b) => <Row key={b.id} b={b} />)}</div>
                </div>
              );
            if (c.bookings.length === 0) return <p className="text-sm text-[var(--color-stone)]">No appointments yet.</p>;
            return (
              <div className="space-y-5">
                <Group title="In progress now" items={inProgress} accent />
                <Group title="Upcoming" items={upcoming} accent />
                <Group title="Past" items={pastBookings} />
              </div>
            );
          })()}
        </section>

        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Timeline</h2>
          <div className="mb-4"><AddNote clientId={c.id} clinical={clinical} /></div>
          {(() => {
            // Hide clinical notes from non-clinical staff; pinned float to the top.
            const visible = c.interactions.filter((it) => it.type !== 'CLINICAL' || clinical);
            const pinned = visible.filter((it) => it.pinned);
            const rest = visible.filter((it) => !it.pinned);
            const Item = ({ it }: { it: (typeof visible)[number] }) => {
              const st = noteStyle(it.type);
              const editable = ['NOTE', 'CLINICAL', 'COMPLAINT', 'FOLLOW_UP', 'CALL'].includes(it.type);
              return (
                <li className="relative">
                  <span className={`absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full ${st.dot}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-wide ${st.badge}`}>{st.label}</span>
                    {it.pinned && <span className="text-[0.6rem] text-[var(--color-gold)]">★ pinned</span>}
                  </div>
                  <p className="mt-1 text-sm font-medium">{it.summary}</p>
                  {it.detail && <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--color-stone)]">{it.detail}</p>}
                  <div className="mt-0.5 flex items-center gap-3">
                    <p className="text-xs text-[var(--color-stone-soft)]">
                      {new Date(it.createdAt).toLocaleString('en-GB')}{it.author ? ` · ${it.author}` : ''}
                    </p>
                    {editable && <PinToggle noteId={it.id} clientId={c.id} pinned={it.pinned} />}
                  </div>
                </li>
              );
            };
            return (
              <>
                {pinned.length > 0 && (
                  <ol className="relative mb-4 space-y-4 rounded-[var(--radius-md)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 border-l-2 border-l-[var(--color-gold)] py-3 pl-5 pr-3">
                    {pinned.map((it) => <Item key={it.id} it={it} />)}
                  </ol>
                )}
                <ol className="relative space-y-4 border-l border-[var(--color-line)] pl-5">
                  {visible.length === 0 && <li className="text-sm text-[var(--color-stone)]">No activity yet.</li>}
                  {rest.map((it) => <Item key={it.id} it={it} />)}
                </ol>
              </>
            );
          })()}
        </section>

        {/* Clinical: K Vision AI consultations (practitioners/admins only) */}
        {clinical && aiAnalyses.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-xl">AI consultations (Get My Plan)</h2>
              <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-[var(--color-gold-soft)]">Encrypted · clinical</span>
            </div>
            <div className="space-y-4">
              {aiAnalyses.map((a) => (
                <div key={a.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{a.summary || 'Analysis'}</p>
                    <p className="text-xs text-[var(--color-stone-soft)]">{new Date(a.createdAt).toLocaleDateString('en-GB')}</p>
                  </div>
                  {a.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {a.images.map((src, i) => <img key={i} src={src} alt="Client upload" className="h-20 w-20 rounded-[var(--radius-sm)] object-cover" />)}
                    </div>
                  )}
                  {a.findings.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm text-[var(--color-stone)]">
                      {a.findings.map((f, i) => <li key={i}><span className="font-medium text-[var(--color-ink)]">{f.label}</span> — {f.note} <span className="text-[var(--color-stone-soft)]">({f.severity})</span></li>)}
                    </ul>
                  )}
                  {a.treatments.length > 0 && <p className="mt-2 text-xs text-[var(--color-stone-soft)]">Plan: {a.treatments.join(' · ')}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Clinical: health assessments (practitioners/admins only) */}
        {clinical && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-xl">Health assessments</h2>
              <span className="rounded-full bg-[var(--color-ink)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-[var(--color-gold-soft)]">Encrypted · clinical</span>
            </div>
            {clinicalAssessments.length === 0 ? (
              <p className="text-sm text-[var(--color-stone)]">No assessments submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {clinicalAssessments.map((a) => (
                  <div key={a.title} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-[var(--color-stone-soft)]">v{a.version} · {new Date(a.submittedAt).toLocaleDateString('en-GB')}</p>
                    </div>
                    {a.tampered && <p className="mt-1 text-xs font-medium text-[var(--color-blush)]">⚠ Integrity check failed — record may have been altered.</p>}
                    {a.translatedNote && <p className="mt-1 inline-block rounded-full bg-[var(--color-bone)] px-2.5 py-0.5 text-[0.65rem] text-[var(--color-stone)]">🌐 {a.translatedNote}</p>}
                    <dl className="mt-3 space-y-2">
                      {a.items.map((it) => (
                        <div key={it.id} className="grid grid-cols-[1fr_1.2fr] gap-3 border-b border-[var(--color-line)] pb-2 last:border-0">
                          <dt className="text-xs text-[var(--color-stone)]">{it.prompt}</dt>
                          <dd className="text-sm">
                            {it.value}
                            {it.original && it.original !== it.value && (
                              <span className="mt-0.5 block text-xs italic text-[var(--color-stone-soft)]">{it.original}</span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        </div>

        <aside className="space-y-8">
          {/* Medical flag (clinical staff only) */}
          {clinical && (
            <MedicalFlagEditor
              clientId={c.id}
              initial={c.medicalFlag}
              setBy={c.medicalFlagSetBy}
              setAt={c.medicalFlagAt ? c.medicalFlagAt.toISOString() : null}
            />
          )}

          {/* Tasks for this client */}
          <ClientTasks
            clientId={c.id}
            tasks={c.tasks.map((tk) => ({
              id: tk.id, title: tk.title, priority: tk.priority as string,
              dueAt: tk.dueAt ? tk.dueAt.toISOString() : null,
              assigneeName: tk.assignee?.name || tk.assignee?.email || null,
            }))}
          />

          {/* Welcome discount */}
          {c.discountClaims.length > 0 && (
            <section>
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Welcome discount</h2>
              <div className="space-y-2">
                {c.discountClaims.map((dc) => (
                  <div key={dc.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm">{dc.status === 'BLOCKED' ? '—' : dc.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${dc.status === 'ACTIVE' ? 'bg-[var(--color-gold)]/20 text-[var(--color-ink)]' : dc.status === 'BLOCKED' ? 'bg-[var(--color-blush)]/25 text-[var(--color-ink)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>
                        {dc.percent}% · {dc.status.toLowerCase()}
                      </span>
                    </div>
                    {dc.flagged && <p className="mt-1 text-xs font-medium text-[var(--color-blush)]">⚠ Flagged — matched an existing claim.</p>}
                    <div className="mt-2 flex items-center gap-2">
                      {dc.status === 'ACTIVE' && <DiscountAction claimId={dc.id} action="revoke" label="Revoke" />}
                      {(dc.status === 'BLOCKED' || dc.status === 'REVOKED') && <DiscountAction claimId={dc.id} action="restore" label="Grant anyway" />}
                      {dc.reviewedBy && <span className="text-xs text-[var(--color-stone-soft)]">by {dc.reviewedBy}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Loyalty points */}
          {loyalty && (loyalty.balance > 0 || loyaltyLedger.length > 0 || canManageLoyalty) && (
            <section>
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Loyalty points</h2>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-gold)]">{loyalty.balance.toLocaleString('en-GB')}</p>
                    <p className="text-xs text-[var(--color-stone)]">points · worth {formatPrice(loyalty.valuePence)}</p>
                  </div>
                  <div className="text-right text-xs text-[var(--color-stone-soft)]">
                    {loyalty.expiringSoon > 0 && <p>{loyalty.expiringSoon} expiring soon</p>}
                    {(loyalty.referralsQualified > 0 || loyalty.referralsPending > 0) && (
                      <p>{loyalty.referralsQualified} referral{loyalty.referralsQualified === 1 ? '' : 's'} rewarded</p>
                    )}
                  </div>
                </div>

                {loyaltyLedger.length > 0 && (
                  <ul className="mt-3 divide-y divide-[var(--color-line)] border-t border-[var(--color-line)] pt-1">
                    {loyaltyLedger.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                        <span className="min-w-0 truncate text-[var(--color-stone)]">{row.reason}</span>
                        <span className={`shrink-0 font-medium ${row.points < 0 ? 'text-[var(--color-stone)]' : 'text-[var(--color-jade)]'}`}>{row.points > 0 ? '+' : ''}{row.points}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {canManageLoyalty && <AdjustClientPoints clientId={c.id} />}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Consultations</h2>
            <div className="space-y-2">
              {c.consultations.length === 0 && <p className="text-sm text-[var(--color-stone)]">None.</p>}
              {c.consultations.map((cn) => (
                <div key={cn.id} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium capitalize">{cn.category}</p>
                    <StatusSelect consultId={cn.id} clientId={c.id} current={cn.status} />
                  </div>
                  {cn.treatments.length > 0 && <p className="mt-1 text-xs text-[var(--color-stone)]">{cn.treatments.join(', ')}</p>}
                  {cn.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{tidyConsultText(cn.message)}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-[var(--color-stone-soft)]">{new Date(cn.createdAt).toLocaleDateString('en-GB')}</p>
                    <Link href={`/admin/consultations/${cn.id}`} className="text-xs text-[var(--color-gold)] hover:underline">Notes →</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Emails</h2>
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
              {c.emails.length === 0 && <p className="p-4 text-sm text-[var(--color-stone)]">No emails sent.</p>}
              {c.emails.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-4 py-2.5 last:border-0">
                  <div>
                    <p className="text-sm">{e.subject}</p>
                    <p className="text-xs text-[var(--color-stone-soft)]">{e.kind.toLowerCase()} · {new Date(e.createdAt).toLocaleDateString('en-GB')}</p>
                  </div>
                  <span className={`text-xs ${e.status === 'SENT' ? 'text-[var(--color-jade)]' : 'text-[var(--color-blush)]'}`}>{e.status.toLowerCase()}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Activity log — audited actions on this client's record */}
          {auditRows.length > 0 && (
            <section>
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Activity log</h2>
              <ol className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
                {auditRows.map((ev) => (
                  <li key={ev.id} className="border-b border-[var(--color-line)] px-4 py-2.5 last:border-0">
                    <p className="text-sm">{ev.summary}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-stone-soft)]">
                      <span className="uppercase tracking-wide">{ev.action.toLowerCase().replace(/_/g, ' ')}</span>
                      {' · '}{ev.actor}{ev.actorRole ? ` (${ev.actorRole.toLowerCase()})` : ''}
                      {' · '}{new Date(ev.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {sessionCan(session, 'clients.export') && <DataPrivacy clientId={c.id} canDelete={sessionCan(session, 'clients.delete')} />}
        </aside>
      </div>
    </AdminShell>
  );
}
