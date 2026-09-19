import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-1845: records the mandatory in-app T&Cs acceptance (components/portal/TermsGate.tsx).
// No-clobber update — first acceptance wins, mirroring every other call site of
// termsAcceptanceFields (see lib/consent.ts).
export async function POST() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient();
  if (!client) return NextResponse.json({ ok: false }, { status: 401 });

  const { db } = await import('@/lib/db');
  const { termsAcceptanceFields } = await import('@/lib/consent');
  await db.client.updateMany({
    where: { id: client.id, termsAcceptedAt: null },
    data: termsAcceptanceFields('portal-mandatory-modal'),
  });

  return NextResponse.json({ ok: true });
}
