import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// One-time, IDEMPOTENT backfill: encrypt any historic PLAINTEXT values in the
// clinical/contact free-text columns that are now encrypted-at-rest going forward
// (Client.medicalFlag/allergies, Consultation.medicalNotes/concerns/message,
// Booking.allergyNote). Reads are tolerant of plaintext, so the app already works
// without this — it just upgrades legacy rows. Safe to run repeatedly: a value
// that already decrypts is left untouched.
//
// Owner-gated. POST it once after the encryption change deploys.
export async function POST() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  // Highest-sensitivity maintenance — require the export-grade clinical permission.
  if (!sessionCan(session, 'clients.export')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { db } = await import('@/lib/db');
  const { encClinical } = await import('@/lib/clinical-crypto');
  const { decryptJson } = await import('@/lib/crypto');

  // True only if the value is NOT already a decryptable keyring blob.
  const isPlaintext = (v: string): boolean => {
    try { decryptJson<string>(v); return false; } catch { return true; }
  };

  const counts: Record<string, number> = {};

  // Generic per-(model,field) backfill over rows where the column is set.
  async function backfill(label: string, rows: { id: string; val: string | null }[], update: (id: string, enc: string) => Promise<unknown>) {
    let n = 0;
    for (const r of rows) {
      if (r.val && isPlaintext(r.val)) { await update(r.id, encClinical(r.val) as string).catch(() => {}); n += 1; }
    }
    counts[label] = n;
  }

  // Client.medicalFlag + Client.allergies
  const clients = await db.client.findMany({ where: { OR: [{ medicalFlag: { not: null } }, { allergies: { not: null } }] }, select: { id: true, medicalFlag: true, allergies: true } });
  await backfill('client.medicalFlag', clients.map((c) => ({ id: c.id, val: c.medicalFlag })), (id, enc) => db.client.update({ where: { id }, data: { medicalFlag: enc } }));
  await backfill('client.allergies', clients.map((c) => ({ id: c.id, val: c.allergies })), (id, enc) => db.client.update({ where: { id }, data: { allergies: enc } }));

  // Consultation.concerns / message / medicalNotes
  const consults = await db.consultation.findMany({ where: { OR: [{ concerns: { not: null } }, { message: { not: null } }, { medicalNotes: { not: null } }] }, select: { id: true, concerns: true, message: true, medicalNotes: true } });
  await backfill('consultation.concerns', consults.map((c) => ({ id: c.id, val: c.concerns })), (id, enc) => db.consultation.update({ where: { id }, data: { concerns: enc } }));
  await backfill('consultation.message', consults.map((c) => ({ id: c.id, val: c.message })), (id, enc) => db.consultation.update({ where: { id }, data: { message: enc } }));
  await backfill('consultation.medicalNotes', consults.map((c) => ({ id: c.id, val: c.medicalNotes })), (id, enc) => db.consultation.update({ where: { id }, data: { medicalNotes: enc } }));

  // Booking.allergyNote
  const bookings = await db.booking.findMany({ where: { allergyNote: { not: null } }, select: { id: true, allergyNote: true } });
  await backfill('booking.allergyNote', bookings.map((b) => ({ id: b.id, val: b.allergyNote })), (id, enc) => db.booking.update({ where: { id }, data: { allergyNote: enc } }));

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'NOTE_ADDED', actor: session!.email, actorRole: session!.role, summary: `Clinical-encryption backfill run: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}` });

  return NextResponse.json({ ok: true, encrypted: counts });
}
