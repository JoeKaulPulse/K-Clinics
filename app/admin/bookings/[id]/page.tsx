import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { BookingActions } from '@/components/admin/BookingActions';
import { PractitionerReassign } from '@/components/admin/PractitionerReassign';
import { RequestCardButton } from '@/components/admin/RequestCardButton';
import { ClinicalWorkflow } from '@/components/admin/ClinicalWorkflow';
import { ConsumablesPanel } from '@/components/admin/ConsumablesPanel';
import { ClinicalNote } from '@/components/admin/ClinicalNote';
import { BookingLocation } from '@/components/admin/BookingLocation';
import { ConsentPanel } from '@/components/admin/ConsentPanel';
import { BeforePhotoCapture } from '@/components/admin/BeforePhotoCapture';
import { ReadinessPanel } from '@/components/admin/ReadinessPanel';
import { AddTreatment } from '@/components/admin/AddTreatment';
import { ScheduleFollowUp } from '@/components/admin/ScheduleFollowUp';
import { SameDayRequestActions } from '@/components/admin/SameDayRequestActions';
import { sessionCan } from '@/lib/auth';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { id } = await params;
  const { getBooking } = await import('@/lib/crm-data');
  const { getSop, parseSopSteps } = await import('@/lib/sops');
  const session = await getSession();
  if (!sessionCan(session, 'bookings.view')) redirect('/admin');
  const b = await getBooking(id);
  if (!b) notFound();

  const within24h = b.startAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const name = [b.client.firstName, b.client.lastName].filter(Boolean).join(' ');
  const sop = await getSop(b.treatmentSlug);
  const sopSteps = parseSopSteps(sop.content);

  // Consent: the form mapped to this treatment + any signed/pending records.
  const { db } = await import('@/lib/db');
  const { templateKeyForTreatment, ensureDefaultTemplates, isLaserTreatment } = await import('@/lib/consent');
  await ensureDefaultTemplates();
  const consentKey = await templateKeyForTreatment(b.treatmentSlug);
  const isLaser = isLaserTreatment(b.treatmentSlug);
  const [consentTemplate, signedConsents, pendingConsents, beforePhotos] = await Promise.all([
    db.consentTemplate.findUnique({ where: { key: consentKey } }),
    db.signedConsent.findMany({ where: { bookingId: b.id }, orderBy: { signedAt: 'desc' }, select: { id: true, title: true, signedAt: true, declined: true, kind: true } }),
    db.consentRequest.findMany({ where: { bookingId: b.id, status: 'PENDING' }, select: { token: true, title: true, kind: true } }),
    db.beforePhoto.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: 'asc' }, select: { id: true, area: true, capturedBy: true, createdAt: true } }),
  ]);
  const optOutSigned = signedConsents.some((s) => s.kind === 'photo_opt_out');

  // Pre-treatment readiness (mirrors the start-gate, shown proactively).
  const { getSettings } = await import('@/lib/settings');
  const { computeReadiness } = await import('@/lib/readiness');
  const S = await getSettings();
  const readiness = computeReadiness({
    isLaser,
    requireConsent: S.require_consent, requireBeforePhoto: S.require_before_photo, requireSop: S.require_sop_ack, requireMedical: S.require_medical_review,
    medicalFlag: !!b.client.medicalFlag, sopAcknowledgedAt: !!b.sopAcknowledgedAt, medicalFlagReviewedAt: !!b.medicalFlagReviewedAt,
    consentSigned: signedConsents.some((s) => s.kind === 'treatment'), consentMapped: !!(consentTemplate && consentTemplate.active),
    photoOrOptOut: beforePhotos.length > 0 || optOutSigned, aftercareAckAt: !!b.aftercareAckAt, started: !!b.startedAt,
  });
  // Decrypt any saved SOP-checklist progress for this booking.
  let sopSaved: { step: string; checked: boolean; response?: string }[] | null = null;
  if (b.sopChecklistEnc) {
    try {
      const { decryptJson } = await import('@/lib/crypto');
      sopSaved = decryptJson<{ items: typeof sopSaved }>(b.sopChecklistEnc).items;
    } catch { /* ignore */ }
  }

  // Consumables (inventory) — items to pick from + what's already logged here.
  const canConsumables = sessionCan(session, 'bookings.manage') && sessionCan(session, 'inventory.view');
  // Rooms / equipment held by this booking (auto-assigned at booking).
  const heldResources = await db.resource.findMany({ where: { bookings: { some: { id } } }, orderBy: { kind: 'asc' }, select: { name: true, kind: true, floor: true } });
  // Hospitality + aftercare + recommended next session for staff.
  const visitPrefs = await db.booking.findUnique({ where: { id }, select: { refreshments: true, allergyNote: true, aftercareAckAt: true, treatmentSlug: true, startAt: true, clientId: true } });
  if (visitPrefs?.allergyNote) { const { decClinical } = await import('@/lib/clinical-crypto'); visitPrefs.allergyNote = decClinical(visitPrefs.allergyNote); }
  const { refreshmentLabel } = await import('@/lib/hospitality');

  // BLD-211 — clinicians eligible to perform this treatment (competent or generalist),
  // for the practitioner-reassign control. The currently-assigned clinician is always
  // included so they remain visible even if competencies later changed.
  const canManageBooking = sessionCan(session, 'bookings.manage');
  const clinicians: { id: string; name: string }[] = [];
  if (canManageBooking) {
    const rows = await db.adminUser.findMany({
      where: { isClinician: true, active: true, OR: [{ competencies: { has: b.treatmentSlug } }, { competencies: { isEmpty: true } }] },
      orderBy: { name: 'asc' }, select: { id: true, name: true, email: true },
    });
    for (const r of rows) clinicians.push({ id: r.id, name: r.name || r.email });
    if (b.practitionerId && b.practitioner && !clinicians.some((c) => c.id === b.practitionerId)) {
      clinicians.unshift({ id: b.practitionerId, name: b.practitioner.name || b.practitioner.email });
    }
  }

  let nextRec: string | null = null;
  // Recommended next-session date, also used to pre-fill the staff follow-up scheduler.
  let followUpRecDate: string | null = null;
  let followUpRecTime: string | null = null;
  let followUpRecLabel: string | null = null;
  if (visitPrefs) {
    const { recommendedNext, formatInterval } = await import('@/lib/treatment-intervals');
    const completed = await db.booking.count({ where: { clientId: visitPrefs.clientId, treatmentSlug: visitPrefs.treatmentSlug, status: 'COMPLETED' } });
    const rec = recommendedNext(visitPrefs.treatmentSlug, completed + 1, visitPrefs.startAt);
    if (rec) {
      nextRec = `${formatInterval(rec.weeks)} (≈ ${rec.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`;
      followUpRecDate = rec.date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD
      followUpRecTime = rec.date.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour12: false, hour: '2-digit', minute: '2-digit' });
      followUpRecLabel = formatInterval(rec.weeks);
    }
  }
  const stockItems = canConsumables
    ? await db.stockItem.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }], select: { id: true, name: true, unit: true, currentQty: true } })
    : [];
  const usedRaw = canConsumables
    ? await db.stockMovement.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' }, include: { item: { select: { name: true, unit: true } } } })
    : [];
  const used = usedRaw.map((m) => ({
    id: m.id, itemName: m.item.name, unit: m.item.unit, qty: Math.abs(m.delta), batchNo: m.batchNo, by: m.by, at: m.createdAt.toISOString(),
  }));

  // Treatments & billing — add-on line items taken on this appointment, plus the
  // variants a clinician can add mid-session (canonical prices).
  const canManageBk = sessionCan(session, 'bookings.manage');
  const addOnItems = await db.bookingItem.findMany({ where: { bookingId: id, isAddon: true }, orderBy: { createdAt: 'asc' }, select: { id: true, label: true, pricePence: true } }).catch(() => []);
  const addOnTotal = addOnItems.reduce((s, it) => s + it.pricePence, 0);
  const basePence = Math.max(0, b.pricePence - addOnTotal);
  // Surface the booked course/session count. Clients can book a Course of 3/6/10,
  // but after booking only the treatment name + total showed — staff couldn't tell
  // how many sessions were paid for. The primary (non-add-on) line item holds it.
  const primaryItem = await db.bookingItem.findFirst({ where: { bookingId: id, isAddon: false }, orderBy: { createdAt: 'asc' }, select: { sessions: true } }).catch(() => null);
  const courseSessions = primaryItem?.sessions ?? 1;
  const perSessionPence = courseSessions > 1 && basePence > 0 ? Math.round(basePence / courseSessions) : basePence;
  const canAddTreatment = canManageBk && !b.chargedAt && !['CANCELLED', 'NO_SHOW'].includes(b.status);
  let variantOptions: { id: string; label: string; pricePence: number }[] = [];
  if (canAddTreatment) {
    const { listServices } = await import('@/lib/services');
    const svcs = await listServices(false).catch(() => []);
    variantOptions = svcs.flatMap((s) => s.variants.map((v) => ({ id: v.id, label: `${s.name} — ${v.name}`, pricePence: v.pricePence }))).slice(0, 300);
  }

  // Clinical treatment note (clinical staff only) — decrypt for display.
  const canClinical = sessionCan(session, 'clients.clinical.view');
  let clinicalNote = '';
  if (canClinical && b.clinicalNoteEnc) {
    try {
      const { decryptJson } = await import('@/lib/crypto');
      clinicalNote = decryptJson<{ note: string }>(b.clinicalNoteEnc).note;
    } catch { /* leave blank if undecryptable */ }
  }

  // Location (multi-site): show a picker when more than one site is configured.
  const { getSetting } = await import('@/lib/settings');
  const activeLocations = await db.location.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, color: true } });
  const multiLocation = (await getSetting('multi_location_enabled')) || activeLocations.length > 1;

  const can = await sessionPermissions();
  const TYPE_LABEL: Record<string, string> = { MEDICAL_HISTORY: 'Medical history', TREATMENT_CONSENT: 'Treatment consent', PRE_TREATMENT: 'Pre-treatment', SKIN_PROFILE: 'Skin profile', DENTAL_HISTORY: 'Dental history' };
  const assessmentLabel = (a: { type: string; questionnaireKey: string }) => {
    const key = (a.questionnaireKey || '').split('@')[0];
    if (key.startsWith('imported-')) return 'Imported ' + key.replace('imported-', '').replace(/-/g, ' ');
    return TYPE_LABEL[a.type] || a.type;
  };
  return (
    <AdminShell user={session?.email} can={can}>
      <Link href="/admin/bookings" className="text-sm text-[var(--color-gold)] hover:underline">← Bookings</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs uppercase tracking-[0.16em]">{b.status}</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">{b.treatmentTitle}</h1>
          <p className="mt-1 text-[var(--color-stone)]">
            {new Date(b.startAt).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
            {' · '}{b.durationMin} min
          </p>
          {courseSessions > 1 ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--color-gold)_16%,transparent)] px-3 py-1 text-sm font-medium text-[var(--color-ink)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3" /></svg>
              Course of {courseSessions} sessions{perSessionPence > 0 ? ` · ${money(perSessionPence)} per session` : ''}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-stone)]">Single session</p>
          )}
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-2xl">{b.pricePence > 0 ? money(b.pricePence) : 'On consultation'}</p>
          {b.chargedAt && <p className="text-xs text-[var(--color-jade)]">Charged {money(b.chargedPence || 0)}</p>}
          {b.lateCancel && <p className="text-xs text-[var(--color-stone)]">Cancelled within 24h{b.feeWaived ? ' · fee waived' : ''}</p>}
        </div>
      </div>

      {b.status === 'REQUESTED' && canManageBk && (
        <div className="mt-6">
          <SameDayRequestActions bookingId={b.id} when={new Date(b.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })} />
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr] [&>section]:min-w-0">
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Client</h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <Link href={`/admin/clients/${b.clientId}`} className="font-medium hover:text-[var(--color-gold)]">{name}</Link>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{b.client.email}{b.client.phone ? ` · ${b.client.phone}` : ''}</p>
            {(() => { const n = (b.notes || '').replace(/\s*\[wp:[^\]]+\]/g, '').trim(); return n ? <p className="mt-3 whitespace-pre-line border-t border-[var(--color-line)] pt-3 text-sm">{n}</p> : null; })()}
            <p className="mt-3 text-xs text-[var(--color-stone)]">
              Card {b.stripePaymentMethodId ? 'saved ✓' : 'not saved'} · booked {new Date(b.createdAt).toLocaleDateString('en-GB')}
            </p>
            {!b.stripePaymentMethodId && !['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(b.status) && sessionCan(session, 'bookings.charge') && (
              <RequestCardButton bookingId={b.id} hasEmail={Boolean(b.client.email)} hasPhone={Boolean(b.client.phone)} />
            )}
          </div>

          {/* Health & consent — clinical safety at a glance */}
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <p className="eyebrow mb-3 text-[var(--color-stone)]">Health &amp; consent</p>
            {b.client.medicalFlag && (
              <p className="mb-3 rounded-[var(--radius-sm)] bg-[color-mix(in_oklab,#c0392b_14%,transparent)] px-3 py-2 text-sm font-medium text-[var(--color-ink)]">⚠ {b.client.medicalFlag}</p>
            )}
            {b.client.allergies && <p className="mb-3 text-sm"><span className="text-[var(--color-stone)]">Allergies:</span> {b.client.allergies}</p>}
            {b.client.assessments.length === 0 ? (
              <p className="text-sm text-[var(--color-stone)]">No health or consent forms on file.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {b.client.assessments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 break-words">{assessmentLabel(a)}</span>
                    <span className="shrink-0 text-xs text-[var(--color-stone)]">{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-GB') : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/admin/clients/${b.clientId}`} className="mt-3 inline-block text-xs text-[var(--color-gold)] hover:underline">View full health records →</Link>
          </div>

          {/* Staff: book the client's next appointment (fills this column + delivers
              the requested follow-up scheduling). Hidden for cancelled/no-show. */}
          {!['CANCELLED', 'NO_SHOW'].includes(b.status) && canManageBk && (
            <ScheduleFollowUp fromBookingId={b.id} recommendedDate={followUpRecDate} recommendedTime={followUpRecTime} recommendedLabel={followUpRecLabel} />
          )}
        </section>

        <section className="space-y-6">
          {/* BLD-138: the immersive in-clinic walkthrough (arrival → wrap-up). */}
          {!['CANCELLED', 'NO_SHOW'].includes(b.status) && sessionCan(session, 'bookings.manage') && (
            <Link
              href={`/admin/bookings/${b.id}/session`}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-gold)]/50 bg-[var(--color-bone)] p-5 transition-all hover:border-[var(--color-gold)] hover:shadow-[var(--shadow-soft)]"
            >
              <span className="min-w-0">
                <span className="block font-[family-name:var(--font-display)] text-lg">Live appointment session</span>
                <span className="mt-0.5 block text-sm text-[var(--color-stone)]">
                  {b.finishedAt ? 'Completed — review the walkthrough & timings' : b.startedAt ? 'In progress — rejoin the walkthrough' : 'Run the guided client walkthrough: arrival, consent, treatment, aftercare'}
                </span>
              </span>
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-gold)] text-white">→</span>
            </Link>
          )}
          {/* Treatments & billing — itemised total; add a treatment mid-session */}
          {!['CANCELLED', 'NO_SHOW'].includes(b.status) && (canManageBk || addOnItems.length > 0) && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
              <p className="eyebrow mb-3 text-[var(--color-stone)]">Treatments &amp; billing</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words">{b.treatmentTitle}{courseSessions > 1 ? ` · course of ${courseSessions}` : ''}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-stone)]">{basePence > 0 ? money(basePence) : 'On consultation'}</span>
                </div>
                {addOnItems.map((it) => (
                  <div key={it.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words text-[var(--color-stone)]">+ {it.label}</span>
                    <span className="shrink-0 tabular-nums text-[var(--color-stone)]">{money(it.pricePence)}</span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-line)] pt-2 font-medium">
                  <span>{b.chargedAt ? 'Charged' : 'Total to charge'}</span>
                  <span className="tabular-nums">{money(b.chargedAt ? (b.chargedPence ?? b.pricePence) : b.pricePence)}</span>
                </div>
              </div>
              {canAddTreatment && <div className="mt-4"><AddTreatment bookingId={b.id} variants={variantOptions} /></div>}
              {b.chargedAt && addOnItems.length > 0 && <p className="mt-3 text-xs text-[var(--color-stone)]">Already charged — add further treatments to a new booking.</p>}
            </div>
          )}
          <ReadinessPanel items={readiness.items} ready={readiness.ready} neededCount={readiness.neededCount} started={!!b.startedAt} />
          <div data-tour="clinical-workflow"><ClinicalWorkflow
            bookingId={b.id}
            sop={{ title: sop.title, content: sop.content }}
            sopSteps={sopSteps}
            sopSaved={sopSaved}
            medicalFlag={b.client.medicalFlag}
            state={{
              sopAcknowledgedAt: b.sopAcknowledgedAt?.toISOString() ?? null,
              medicalFlagReviewedAt: b.medicalFlagReviewedAt?.toISOString() ?? null,
              startedAt: b.startedAt?.toISOString() ?? null,
              finishedAt: b.finishedAt?.toISOString() ?? null,
              actualMinutes: b.actualMinutes,
              durationMin: b.durationMin,
              status: b.status,
            }}
          /></div>
          <div data-tour="clinical-consent"><ConsentPanel
            bookingId={b.id}
            clientId={b.client.id}
            treatmentForm={consentTemplate && consentTemplate.active ? { key: consentTemplate.key, title: consentTemplate.title } : null}
            signed={signedConsents.map((s) => ({ id: s.id, title: s.title, signedAt: s.signedAt.toISOString(), declined: s.declined, kind: s.kind }))}
            pending={pendingConsents}
            baseUrl={site.url.replace(/\/$/, '')}
            canClinical={sessionCan(session, 'clients.clinical.view')}
            canManage={sessionCan(session, 'bookings.manage')}
          /></div>
          <div data-tour="clinical-photo"><BeforePhotoCapture
            bookingId={b.id}
            clientId={b.client.id}
            photos={beforePhotos.map((p) => ({ id: p.id, area: p.area, capturedBy: p.capturedBy, createdAt: p.createdAt.toISOString() }))}
            optOutSigned={optOutSigned}
            baseUrl={site.url.replace(/\/$/, '')}
            canManage={sessionCan(session, 'bookings.manage')}
            required={isLaser}
          /></div>
          {canConsumables && <ConsumablesPanel bookingId={b.id} items={stockItems} used={used} />}
          {canClinical && <div data-tour="clinical-note"><ClinicalNote bookingId={b.id} initial={clinicalNote} savedBy={b.clinicalNoteBy} savedAt={b.clinicalNoteAt ? b.clinicalNoteAt.toISOString() : null} /></div>}
          {multiLocation && activeLocations.length > 0 && <BookingLocation bookingId={b.id} current={b.locationId} locations={activeLocations} />}
          <div data-tour="clinical-actions">
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Actions</h2>
            <BookingActions
              bookingId={b.id}
              status={b.status}
              pricePence={b.pricePence}
              within24h={within24h}
              charged={b.chargedAt ? (b.chargedPence ?? 0) : null}
              refunded={b.refundedPence ?? null}
              refundableUntil={b.chargedAt ? new Date(b.chargedAt.getTime() + (await import('@/lib/settings').then((m) => m.getConfigNumber('refund_window_days'))) * 24 * 60 * 60 * 1000).toISOString() : null}
              canManage={sessionCan(session, 'bookings.manage')}
              canCharge={sessionCan(session, 'bookings.charge')}
            />
          </div>
        </section>
      </div>

      {/* Immutable audit trail */}
      <section className="mt-10">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Activity log</h2>
        <p className="mb-4 text-xs text-[var(--color-stone)]">An immutable record of every action on this booking.</p>
        <ol className="relative space-y-3 border-l border-[var(--color-line)] pl-5">
          {b.auditEvents.length === 0 && <li className="text-sm text-[var(--color-stone)]">No activity recorded yet.</li>}
          {b.auditEvents.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-gold)]" />
              <p className="text-sm font-medium">{e.summary}</p>
              <p className="mt-0.5 text-xs text-[var(--color-stone)]">
                {new Date(e.createdAt).toLocaleString('en-GB')} · {e.action.toLowerCase().replace(/_/g, ' ')} · {e.actor}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {canManageBooking ? (
        <PractitionerReassign bookingId={b.id} current={b.practitionerId ?? null} clinicians={clinicians} />
      ) : b.practitioner ? (
        <p className="mt-6 text-sm text-[var(--color-stone)]">Assigned clinician: <span className="font-medium text-[var(--color-ink)]">{b.practitioner.name || b.practitioner.email}</span></p>
      ) : null}
      {heldResources.length > 0 && (
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          {heldResources.map((r) => `${r.name}${r.floor ? ` (${r.floor})` : ''}`).join(' · ')}
        </p>
      )}

      {visitPrefs && (visitPrefs.refreshments.length > 0 || visitPrefs.allergyNote || nextRec || visitPrefs.aftercareAckAt) && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-4 text-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-stone)]">Visit prep</p>
          {visitPrefs.refreshments.length > 0 && <p>☕ Refreshments: <span className="font-medium text-[var(--color-ink)]">{visitPrefs.refreshments.map(refreshmentLabel).join(', ')}</span></p>}
          {visitPrefs.allergyNote && <p className="text-[var(--color-blush)]">⚠ Allergies/dietary: <span className="font-medium">{visitPrefs.allergyNote}</span></p>}
          <p className="text-[var(--color-stone)]">Aftercare agreed: {visitPrefs.aftercareAckAt ? `Yes (${visitPrefs.aftercareAckAt.toLocaleDateString('en-GB')})` : 'Not yet'}</p>
          {nextRec && <p className="text-[var(--color-stone)]">Recommended next session: <span className="font-medium text-[var(--color-ink)]">{nextRec}</span></p>}
        </div>
      )}
    </AdminShell>
  );
}
