import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { logKioskEvent } from '@/lib/kiosk';
import { KioskSessionFlow } from '@/components/kiosk/KioskSessionFlow';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your Skin & Smile Score — KClinics',
  robots: { index: false, follow: false },
};

// Mobile session entry. Validates the token (redirect to the display if it's
// expired or unknown), logs a `scan` funnel event, then renders the client flow.
export default async function KioskTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const session = await db.kioskSession.findUnique({
    where: { token },
    include: { result: { select: { id: true } } },
  });
  if (!session) redirect('/kiosk/display');

  const expired = session.status === 'EXPIRED' || (session.expiresAt < new Date() && session.status !== 'ANALYZED' && session.status !== 'SHARED');
  if (expired) redirect('/kiosk/display');

  await logKioskEvent('scan', session.id, session.ipHash);

  return (
    <KioskSessionFlow
      token={token}
      sessionId={session.id}
      initialStatus={session.status}
      initialResultId={session.result?.id ?? null}
    />
  );
}
