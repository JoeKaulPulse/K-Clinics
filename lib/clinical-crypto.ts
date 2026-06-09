import 'server-only';
import { encryptJson, decryptJson } from '@/lib/crypto';

// Transparent at-rest encryption for the special-category / contact free-text
// columns that historically sat in PLAINTEXT outside the keyring (Client.medicalFlag
// /allergies, Consultation.medicalNotes/concerns/message, Booking.allergyNote).
//
// Design constraints that make this safe on the LIVE medical DB:
//   • decClinical TOLERATES legacy plaintext — existing rows still display while
//     new writes are encrypted, so no backfill is required for correctness (a
//     backfill just upgrades old rows; see scripts/backfill-clinical-encryption.mjs).
//   • encClinical/decClinical round-trip null/empty unchanged, so optional columns
//     stay optional and "no value" never becomes ciphertext.
// Apply encClinical at EVERY write and decClinical at EVERY read of these fields.
// Because the values become ciphertext, they can no longer be matched with a SQL
// `contains` filter — any search over them must be dropped or moved to a separate
// non-clinical index.

/** Encrypt a clinical/PII free-text value for storage. Passes through null/empty. */
export function encClinical<T extends string | null | undefined>(value: T): T | string {
  if (value == null || value === '') return value;
  return encryptJson(value);
}

/** Decrypt a stored clinical/PII value. Tolerates legacy plaintext (returns it
 *  as-is if it isn't a keyring blob), and passes through null/empty. */
export function decClinical<T extends string | null | undefined>(value: T): T {
  if (value == null || value === '') return value;
  try {
    return decryptJson<string>(value) as T;
  } catch {
    return value; // legacy plaintext written before encryption was introduced
  }
}
