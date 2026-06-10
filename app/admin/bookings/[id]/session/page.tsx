import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SessionRunner } from '@/components/admin/session/SessionRunner';

export const dynamic = 'force-dynamic';

// BLD-138 v2 — the live appointment session. A full-screen, realtime canvas:
// every open device follows the same session over SSE, staff hand off between
// steps, and the client follows along on their phone via the QR'd live link.
export default async function AppointmentSessionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { id } = await params;
  const session = await getSession();
  if (!sessionCan(session, 'bookings.manage') || !session) redirect('/admin');

  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true, medicalFlag: true } },
      practitioner: { select: { name: true } },
      items: { select: { label: true, isAddon: true } },
      liveSession: { select: { id: true } },
    },
  });
  if (!b) notFound();
  if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') redirect(`/admin/bookings/${id}`);

  const { getSop, parseSopSteps } = await import('@/lib/sops');
  const sop = await getSop(b.treatmentSlug);
  const sopSteps = parseSopSteps(sop.content);

  const { categoryForTreatment, ensureDefaultTemplates, isLaserTreatment } = await import('@/lib/consent');
  await ensureDefaultTemplates();
  const consentKey = await categoryForTreatment(b.treatmentSlug);
  const isLaser = isLaserTreatment(b.treatmentSlug);

  const [consentTemplate, pendingConsents] = await Promise.all([
    db.consentTemplate.findUnique({ where: { key: consentKey }, select: { key: true, title: true, active: true } }),
    db.consentRequest.findMany({ where: { bookingId: b.id, status: 'PENDING' }, select: { token: true, kind: true } }),
  ]);

  const { getSettings } = await import('@/lib/settings');
  const S = await getSettings();

  // Saved SOP checklist progress (encrypted at rest).
  let sopSaved: { step: string; checked: boolean; response?: string }[] | null = null;
  if (b.sopChecklistEnc) {
    try { const { decryptJson } = await import('@/lib/crypto'); sopSaved = decryptJson<{ items: typeof sopSaved }>(b.sopChecklistEnc).items; } catch { /* ignore */ }
  }

  // Clinical context — decrypted only for staff with clinical access.
  const canClinical = sessionCan(session, 'clients.clinical.view');
  let allergyNote: string | null = null;
  let clinicalNote = '';
  if (canClinical) {
    if (b.allergyNote) { try { const { decClinical } = await import('@/lib/clinical-crypto'); allergyNote = decClinical(b.allergyNote); } catch { /* ignore */ } }
    if (b.clinicalNoteEnc) { try { const { decryptJson } = await import('@/lib/crypto'); clinicalNote = decryptJson<{ note: string }>(b.clinicalNoteEnc).note; } catch { /* ignore */ } }
  }

  // Aftercare guide for this treatment's group (curated, client-facing).
  const { getTreatment } = await import('@/lib/treatments');
  const { guideForGroup } = await import('@/lib/aftercare');
  const guide = guideForGroup(getTreatment(b.treatmentSlug)?.group);
  const aftercare = { title: guide.titleEn, intro: guide.introEn, items: guide.items.map((i) => ({ icon: i.icon, text: i.en })) };

  // Who am I — identity carried into every handoff/touchpoint.
  const { getStaffProfile, sessionSnapshot } = await import('@/lib/appointment-session-server');
  const me = await getStaffProfile(session.email);

  // The client's live phone companion (QR on the arrival step).
  const { qrSvg } = await import('@/lib/qr');
  const { site } = await import('@/lib/site');
  const baseUrl = site.url.replace(/\/$/, '');
  const liveUrl = `${baseUrl}/live/${b.manageToken}`;
  const liveQrSvg = await qrSvg(liveUrl, { dark: '#2a2420', light: '#f6ece3' }).catch(() => '');

  // Boutique: sellable products for the in-session POS hand-off.
  const canPos = sessionCan(session, 'pos.use');
  const products = canPos
    ? (await db.product.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' }, take: 60,
        select: { id: true, name: true, pricePence: true, stockQty: true, trackInventory: true, ageRestricted: true },
      })).map((p) => ({ ...p, soldOut: p.trackInventory && p.stockQty <= 0 }))
    : [];

  // Next-visit recommendation from the treatment-interval engine.
  const { recommendedNext, formatInterval } = await import('@/lib/treatment-intervals');
  const completed = await db.booking.count({ where: { clientId: b.client.id, treatmentSlug: b.treatmentSlug, status: 'COMPLETED' } });
  const rec = recommendedNext(b.treatmentSlug, completed + 1, b.startAt);
  const nextRec = rec ? { dateISO: rec.date.toISOString().slice(0, 10), label: formatInterval(rec.weeks), maintenance: rec.maintenance } : null;

  // Seed the runner with a server-rendered snapshot (no first-paint flash).
  const initialSnapshot = b.liveSession ? await sessionSnapshot(b.id) : null;

  const { refreshmentLabel } = await import('@/lib/hospitality');

  return (
    <main className="min-h-dvh bg-[var(--color-porcelain)] text-[var(--color-ink)]">
      <SessionRunner
        me={me}
        canCharge={sessionCan(session, 'bookings.charge')}
        canPos={canPos}
        canClinical={canClinical}
        liveUrl={liveUrl}
        liveQrSvg={liveQrSvg}
        products={products}
        nextRec={nextRec}
        booking={{
          id: b.id,
          treatmentSlug: b.treatmentSlug,
          treatmentTitle: b.treatmentTitle,
          startAt: b.startAt.toISOString(),
          durationMin: b.durationMin,
          pricePence: b.pricePence,
          refreshments: b.refreshments.map((r) => refreshmentLabel(r)),
          addOns: b.items.filter((i) => i.isAddon).map((i) => i.label),
        }}
        client={{
          id: b.client.id,
          firstName: b.client.firstName,
          fullName: [b.client.firstName, b.client.lastName].filter(Boolean).join(' '),
          email: b.client.email,
          medicalFlag: canClinical ? b.client.medicalFlag : (b.client.medicalFlag ? 'Flag on file — see client record' : null),
          allergyNote,
        }}
        practitionerName={b.practitioner?.name || null}
        sop={{ title: sop.title, steps: sopSteps, saved: sopSaved }}
        consent={{
          required: S.require_consent,
          templateKey: consentTemplate?.active ? consentTemplate.key : null,
          pendingToken: pendingConsents.find((p) => p.kind === 'treatment')?.token ?? null,
        }}
        gates={{
          requireSop: S.require_sop_ack,
          requireMedical: S.require_medical_review,
          requireBeforePhoto: isLaser && S.require_before_photo,
          isLaser,
        }}
        clinicalNote={clinicalNote}
        aftercare={aftercare}
        initialSnapshot={initialSnapshot}
      />
      <noscript>
        <div className="p-8 text-center">
          The live session needs JavaScript. <Link href={`/admin/bookings/${b.id}`} className="underline">Back to the booking</Link>
        </div>
      </noscript>
    </main>
  );
}
