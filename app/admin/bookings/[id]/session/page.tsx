import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { SessionRunner } from '@/components/admin/session/SessionRunner';

export const dynamic = 'force-dynamic';

// BLD-138 — the live appointment session. A deliberately immersive, full-screen
// canvas (no admin sidebar): the clinician drives it and can turn the screen to
// the client at the client-facing steps. All clinical gates run through the
// existing server actions; this page just assembles the context.
export default async function AppointmentSessionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { id } = await params;
  const session = await getSession();
  if (!sessionCan(session, 'bookings.manage')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, medicalFlag: true, allergies: true } },
      practitioner: { select: { name: true, email: true } },
      items: { select: { label: true, isAddon: true } },
      liveSession: true,
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

  const [consentTemplate, signedConsents, pendingConsents, beforePhoto] = await Promise.all([
    db.consentTemplate.findUnique({ where: { key: consentKey }, select: { key: true, title: true, active: true } }),
    db.signedConsent.findMany({ where: { bookingId: b.id }, orderBy: { signedAt: 'desc' }, select: { title: true, signedAt: true, kind: true, contentHash: true } }),
    db.consentRequest.findMany({ where: { bookingId: b.id, status: 'PENDING' }, select: { token: true, title: true, kind: true } }),
    db.beforePhoto.findFirst({ where: { bookingId: b.id }, select: { id: true } }),
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

  const { refreshmentLabel } = await import('@/lib/hospitality');
  const { site } = await import('@/lib/site');

  return (
    <main className="min-h-dvh bg-[var(--color-porcelain)] text-[var(--color-ink)]">
      <SessionRunner
        baseUrl={site.url.replace(/\/$/, '')}
        booking={{
          id: b.id,
          treatmentTitle: b.treatmentTitle,
          treatmentSlug: b.treatmentSlug,
          startAt: b.startAt.toISOString(),
          durationMin: b.durationMin,
          status: b.status,
          startedAt: b.startedAt?.toISOString() ?? null,
          finishedAt: b.finishedAt?.toISOString() ?? null,
          actualMinutes: b.actualMinutes,
          aftercareAckAt: b.aftercareAckAt?.toISOString() ?? null,
          sopAcknowledgedAt: b.sopAcknowledgedAt?.toISOString() ?? null,
          medicalFlagReviewedAt: b.medicalFlagReviewedAt?.toISOString() ?? null,
          refreshments: b.refreshments.map((r) => refreshmentLabel(r)),
          addOns: b.items.filter((i) => i.isAddon).map((i) => i.label),
        }}
        client={{
          firstName: b.client.firstName,
          fullName: [b.client.firstName, b.client.lastName].filter(Boolean).join(' '),
          medicalFlag: canClinical ? b.client.medicalFlag : (b.client.medicalFlag ? 'Flag on file — see client record' : null),
          allergyNote,
        }}
        practitionerName={b.practitioner?.name || null}
        sop={{ title: sop.title, steps: sopSteps, saved: sopSaved }}
        consent={{
          required: S.require_consent,
          templateKey: consentTemplate?.active ? consentTemplate.key : null,
          templateTitle: consentTemplate?.title ?? null,
          signed: signedConsents.filter((s) => s.kind === 'treatment').map((s) => ({ title: s.title, signedAt: s.signedAt.toISOString(), cert: s.contentHash.slice(0, 12) })),
          pendingToken: pendingConsents.find((p) => p.kind === 'treatment')?.token ?? null,
        }}
        gates={{
          requireSop: S.require_sop_ack,
          requireMedical: S.require_medical_review,
          requireBeforePhoto: isLaser && S.require_before_photo,
          hasBeforePhoto: !!beforePhoto || signedConsents.some((s) => s.kind === 'photo_opt_out'),
          isLaser,
        }}
        canClinical={canClinical}
        clinicalNote={clinicalNote}
        clientId={b.client.id}
        aftercare={aftercare}
        existingSession={b.liveSession ? {
          status: b.liveSession.status,
          currentStep: b.liveSession.currentStep,
          steps: b.liveSession.steps as Record<string, { enteredAt: string | null; seconds: number; visits: number; skipped?: boolean }>,
          data: b.liveSession.data as Record<string, { value: string; by: string; at: string }>,
        } : null}
      />
      <noscript>
        <div className="p-8 text-center">
          The live session needs JavaScript. <Link href={`/admin/bookings/${b.id}`} className="underline">Back to the booking</Link>
        </div>
      </noscript>
    </main>
  );
}
