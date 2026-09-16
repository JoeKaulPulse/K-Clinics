import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-1763 — manage an existing "Mark as Debt" record (see BLD-1572, the
// original create-only flow). Same `bookings.charge` gate as recording the
// debt in the first place: correcting or clearing a money-owed record is a
// financial write, not a routine profile edit.
const MAX_DEBT_PENCE = 100_000_000; // mirrors the create-route bound (BLD-1572)

async function loadDebt(clientId: string, debtId: string, practitionerId?: string) {
  const { db } = await import('@/lib/db');
  // PRJ-1200.1: mirror the practitionerId ownership check lib/crm-data.ts and
  // the consultation-notes route already apply — a PRACTITIONER holding
  // bookings.charge must not be able to edit/clear a debt on a client they've
  // never actually had a booking with.
  if (practitionerId) {
    const own = await db.booking.findFirst({ where: { clientId, practitionerId }, select: { id: true } });
    if (!own) return null;
  }
  const debt = await db.clientDebt.findUnique({ where: { id: debtId }, select: { id: true, clientId: true, resolvedAt: true } });
  if (!debt || debt.clientId !== clientId) return null;
  return debt;
}

// Edit the recorded amount and/or reason. The client no longer owes what was
// first typed in (partial payment, corrected figure) but the balance itself
// still stands.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; debtId: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { id: clientId, debtId } = await params;

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'bookings.charge')) {
    return NextResponse.json({ ok: false, error: 'You don’t have permission to edit an outstanding balance.' }, { status: 403 });
  }

  const existing = await loadDebt(clientId, debtId, session!.role === 'PRACTITIONER' ? session!.sub : undefined);
  if (!existing) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
  if (existing.resolvedAt) return NextResponse.json({ ok: false, error: 'This balance has already been cleared.' }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const amountPence = Math.round(Number(body.amountPence));
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : '';
  if (!Number.isFinite(amountPence) || amountPence <= 0) {
    return NextResponse.json({ ok: false, error: 'Enter an amount owed greater than £0.' }, { status: 422 });
  }
  if (amountPence > MAX_DEBT_PENCE) {
    return NextResponse.json({ ok: false, error: 'That amount looks wrong — check the figure and try again.' }, { status: 422 });
  }
  if (!reason) {
    return NextResponse.json({ ok: false, error: 'Add a reason explaining why the payment is outstanding.' }, { status: 422 });
  }

  const { db } = await import('@/lib/db');
  await db.clientDebt.update({ where: { id: debtId }, data: { amountPence, reason } });

  try {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({
      action: 'CLIENT_DEBT_UPDATED',
      actor: session!.email,
      actorRole: session!.role,
      clientId,
      summary: `Outstanding balance corrected — now £${(amountPence / 100).toFixed(2)}`,
      meta: { debtId, amountPence, reason },
    });
  } catch { /* audit is best-effort */ }

  return NextResponse.json({ ok: true });
}

// Clear/waive the debt — the client no longer owes it (paid another way,
// waived, or it was recorded in error). Soft-deleted via resolvedAt so the
// record and its audit trail are retained, matching every other
// money-owed mechanism on the client profile.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; debtId: string }> }) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { id: clientId, debtId } = await params;

  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'bookings.charge')) {
    return NextResponse.json({ ok: false, error: 'You don’t have permission to clear an outstanding balance.' }, { status: 403 });
  }

  const existing = await loadDebt(clientId, debtId, session!.role === 'PRACTITIONER' ? session!.sub : undefined);
  if (!existing) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 });
  if (existing.resolvedAt) return NextResponse.json({ ok: true }); // already cleared — idempotent

  const { db } = await import('@/lib/db');
  await db.clientDebt.update({ where: { id: debtId }, data: { resolvedAt: new Date(), resolvedBy: session!.email } });

  try {
    const { logAudit } = await import('@/lib/audit');
    await logAudit({
      action: 'CLIENT_DEBT_RESOLVED',
      actor: session!.email,
      actorRole: session!.role,
      clientId,
      summary: 'Outstanding balance cleared',
      meta: { debtId },
    });
  } catch { /* audit is best-effort */ }

  return NextResponse.json({ ok: true });
}
