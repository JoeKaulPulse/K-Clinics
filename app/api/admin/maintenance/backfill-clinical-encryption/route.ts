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

  const { runClinicalEncryptionBackfill } = await import('@/lib/clinical-crypto-backfill');
  const { encrypted } = await runClinicalEncryptionBackfill();

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'NOTE_ADDED', actor: session!.email, actorRole: session!.role, summary: `Clinical-encryption backfill run: ${Object.entries(encrypted).map(([k, v]) => `${k}=${v}`).join(', ')}` });

  return NextResponse.json({ ok: true, encrypted });
}
