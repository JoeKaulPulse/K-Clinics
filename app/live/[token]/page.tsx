import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { LiveCompanion } from '@/components/live/LiveCompanion';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your visit — live · KClinics', robots: { index: false, follow: false } };

// BLD-138 v2 — the client's live visit companion. Opened from the QR on the
// in-clinic session screen (token = the booking's unguessable manageToken).
// A chromeless, phone-first page: the visit's stages unfold in real time, with
// the person looking after the client named at every touchpoint.
export default async function LivePage({ params }: { params: Promise<{ token: string }> }) {
  if (!crmEnabled) notFound();
  const { token } = await params;
  const { db } = await import('@/lib/db');
  const b = await db.booking.findUnique({
    where: { manageToken: token },
    select: {
      id: true, treatmentTitle: true, startAt: true, durationMin: true,
      client: { select: { firstName: true } },
      practitioner: { select: { name: true } },
    },
  });
  if (!b) notFound();

  const { sessionSnapshot, clientView } = await import('@/lib/appointment-session-server');
  const snap = await sessionSnapshot(b.id);
  const initial = snap ? clientView(snap) : null;

  return (
    <LiveCompanion
      token={token}
      firstName={b.client.firstName}
      treatmentTitle={b.treatmentTitle}
      startAt={b.startAt.toISOString()}
      durationMin={b.durationMin}
      practitionerName={b.practitioner?.name ?? null}
      initial={initial}
    />
  );
}
