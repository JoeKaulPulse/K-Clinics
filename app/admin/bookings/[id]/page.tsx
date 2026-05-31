import Link from 'next/link';
import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { BookingActions } from '@/components/admin/BookingActions';
import { ClinicalWorkflow } from '@/components/admin/ClinicalWorkflow';
import { ConsumablesPanel } from '@/components/admin/ConsumablesPanel';
import { ClinicalNote } from '@/components/admin/ClinicalNote';
import { BookingLocation } from '@/components/admin/BookingLocation';
import { sessionCan } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { id } = await params;
  const { getBooking } = await import('@/lib/crm-data');
  const { getSop, parseSopSteps } = await import('@/lib/sops');
  const session = await getSession();
  const b = await getBooking(id);
  if (!b) notFound();

  const within24h = b.startAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const name = [b.client.firstName, b.client.lastName].filter(Boolean).join(' ');
  const sop = await getSop(b.treatmentSlug);
  const sopSteps = parseSopSteps(sop.content);
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
  const { db } = await import('@/lib/db');
  const stockItems = canConsumables
    ? await db.stockItem.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }], select: { id: true, name: true, unit: true, currentQty: true } })
    : [];
  const usedRaw = canConsumables
    ? await db.stockMovement.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' }, include: { item: { select: { name: true, unit: true } } } })
    : [];
  const used = usedRaw.map((m) => ({
    id: m.id, itemName: m.item.name, unit: m.item.unit, qty: Math.abs(m.delta), batchNo: m.batchNo, by: m.by, at: m.createdAt.toISOString(),
  }));

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
  return (
    <AdminShell user={session?.email} can={can}>
      <Link href="/admin/bookings" className="text-sm text-[var(--color-gold)] hover:underline">← Bookings</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs uppercase tracking-[0.16em]">{b.status}</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">{b.treatmentTitle}</h1>
          <p className="mt-1 text-[var(--color-stone)]">
            {new Date(b.startAt).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {' · '}{b.durationMin} min
          </p>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-2xl">{b.pricePence > 0 ? money(b.pricePence) : 'On consultation'}</p>
          {b.chargedAt && <p className="text-xs text-[var(--color-jade)]">Charged {money(b.chargedPence || 0)}</p>}
          {b.lateCancel && <p className="text-xs text-[var(--color-stone)]">Cancelled within 24h{b.feeWaived ? ' · fee waived' : ''}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Client</h2>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <Link href={`/admin/clients/${b.clientId}`} className="font-medium hover:text-[var(--color-gold)]">{name}</Link>
            <p className="mt-1 text-sm text-[var(--color-stone)]">{b.client.email}{b.client.phone ? ` · ${b.client.phone}` : ''}</p>
            {b.notes && <p className="mt-3 border-t border-[var(--color-line)] pt-3 text-sm">{b.notes}</p>}
            <p className="mt-3 text-xs text-[var(--color-stone-soft)]">
              Card {b.stripePaymentMethodId ? 'saved ✓' : 'not saved'} · booked {new Date(b.createdAt).toLocaleDateString('en-GB')}
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <ClinicalWorkflow
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
          />
          {canConsumables && <ConsumablesPanel bookingId={b.id} items={stockItems} used={used} />}
          {canClinical && <ClinicalNote bookingId={b.id} initial={clinicalNote} savedBy={b.clinicalNoteBy} savedAt={b.clinicalNoteAt ? b.clinicalNoteAt.toISOString() : null} />}
          {multiLocation && activeLocations.length > 0 && <BookingLocation bookingId={b.id} current={b.locationId} locations={activeLocations} />}
          <div>
            <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Actions</h2>
            <BookingActions
              bookingId={b.id}
              status={b.status}
              pricePence={b.pricePence}
              within24h={within24h}
              charged={b.chargedAt ? (b.chargedPence ?? 0) : null}
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
              <p className="mt-0.5 text-xs text-[var(--color-stone-soft)]">
                {new Date(e.createdAt).toLocaleString('en-GB')} · {e.action.toLowerCase().replace(/_/g, ' ')} · {e.actor}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {b.practitioner && (
        <p className="mt-6 text-sm text-[var(--color-stone)]">Assigned clinician: <span className="font-medium text-[var(--color-ink)]">{b.practitioner.name || b.practitioner.email}</span></p>
      )}
    </AdminShell>
  );
}
