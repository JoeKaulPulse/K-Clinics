import 'server-only';

// BLD-248 — idempotent backfill that encrypts any historic PLAINTEXT values in
// the clinical/contact free-text columns that are encrypted-at-rest going
// forward (Client.medicalFlag/allergies, Consultation.medicalNotes/concerns/
// message, Booking.allergyNote). Reads tolerate plaintext, so the app already
// works without this — it just upgrades legacy rows. Safe to run repeatedly: a
// value that already decrypts is left untouched. Shared by the owner-gated admin
// endpoint and the self-healing daily-cron pass.
export async function runClinicalEncryptionBackfill(): Promise<{ encrypted: Record<string, number>; total: number }> {
  const { db } = await import('@/lib/db');
  const { encClinical } = await import('@/lib/clinical-crypto');
  const { decryptJson } = await import('@/lib/crypto');

  // True only if the value is NOT already a decryptable keyring blob.
  const isPlaintext = (v: string): boolean => {
    try { decryptJson<string>(v); return false; } catch { return true; }
  };

  const counts: Record<string, number> = {};
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

  // ConsultationNote.body (BLD-913) — staff team notes, plaintext until then.
  const cNotes = await db.consultationNote.findMany({ select: { id: true, body: true } });
  await backfill('consultationNote.body', cNotes.map((n) => ({ id: n.id, val: n.body })), (id, enc) => db.consultationNote.update({ where: { id }, data: { body: enc } }));

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return { encrypted: counts, total };
}

// BLD-913: key bumped to v2 so the sweep re-runs for the newly-encrypted
// ConsultationNote.body — the v1 flag was already set in production, which
// would have skipped the new field forever. Old fields no-op (isPlaintext
// is false for their existing ciphertext), so the re-scan is one cheap pass.
const DONE_KEY = 'clinical_backfill_complete_v2';

/**
 * Self-healing daily pass (BLD-248): runs the backfill automatically until one
 * pass encrypts zero rows, then sets a flag so future days skip the scan (all
 * write paths already encrypt, so no new plaintext should appear). Returns a
 * small summary; never throws into the cron.
 */
export async function backfillClinicalEncryptionIfNeeded(): Promise<{ ran: boolean; total: number; complete: boolean }> {
  const { db } = await import('@/lib/db');
  const done = await db.setting.findUnique({ where: { key: DONE_KEY } }).catch(() => null);
  if (done?.value === 'true') return { ran: false, total: 0, complete: true };

  const { total } = await runClinicalEncryptionBackfill();
  // A clean pass (nothing left to encrypt) marks the migration complete.
  const complete = total === 0;
  if (complete) {
    await db.setting.upsert({ where: { key: DONE_KEY }, update: { value: 'true' }, create: { key: DONE_KEY, value: 'true' } }).catch(() => {});
  }
  return { ran: true, total, complete };
}
