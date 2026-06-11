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
export default async function KioskTokenPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ s?: string }> }) {
  const { token } = await params;
  // BLD-159: the capability secret comes from the QR (?s=) only — never looked
  // up from the session here, or a token-guesser loading this page would obtain it.
  const { s: secret } = await searchParams;

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
      secret={secret}
      sessionId={session.id}
      initialStatus={session.status}
      initialResultId={session.result?.id ?? null}
    />
  );
}
