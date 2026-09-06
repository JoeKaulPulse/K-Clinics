import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-1572 — "Mark as Debt": staff manually record that a client owes the
// clinic money (card declined, payment failed, walked out without paying…).
// Gated on `bookings.charge` — the same permission every other financial
// write on a booking/client needs (charge, refund, waive a fee), since this
// creates a lasting money-owed record on the client's profile.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { id: clientId } = await params;

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'bookings.charge')) {
    return NextResponse.json({ ok: false, error: 'You don’t have permission to record an outstanding balance.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const amountPence = Math.round(Number(body.amountPence));
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : '';
  const bookingIdIn = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';

  if (!Number.isFinite(amountPence) || amountPence <= 0) {
    return NextResponse.json({ ok: false, error: 'Enter an amount owed greater than £0.' }, { status: 422 });
  }
  if (!reason) {
    return NextResponse.json({ ok: false, error: 'Add a reason explaining why the payment is outstanding.' }, { status: 422 });
  }

  const { db } = await import('@/lib/db');
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ ok: false, error: 'Client not found.' }, { status: 404 });

  // A supplied booking must belong to this same client, mirroring the same
  // guard on the incident-report route — never let a debt get mis-linked to
  // another client's appointment.
  let bookingId: string | null = null;
  if (bookingIdIn) {
    const bk = await db.booking.findUnique({ where: { id: bookingIdIn }, select: { clientId: true } });
    if (bk && bk.clientId === clientId) bookingId = bookingIdIn;
  }

  const debt = await db.clientDebt.create({
    data: { clientId, bookingId, amountPence, reason, createdBy: session!.email },
    select: { id: true },
  });

  try {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({
      action: 'CLIENT_DEBT_RECORDED',
      actor: session!.email,
      actorRole: session!.role,
      clientId,
      bookingId,
      summary: `Marked as debt — £${(amountPence / 100).toFixed(2)} outstanding`,
      meta: { amountPence, reason },
    });
  } catch { /* audit is best-effort */ }

  return NextResponse.json({ ok: true, id: debt.id });
}
