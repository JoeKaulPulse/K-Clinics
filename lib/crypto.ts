import 'server-only';
import crypto from 'crypto';

/**
 * App-level encryption for sensitive clinical data (health assessments).
 *
 *  • Confidentiality: AES-256-GCM with a per-record random IV.
 *  • Integrity/authenticity: GCM auth tag + a separate HMAC-SHA256 over the
 *    ciphertext and bound metadata, so any tampering (including swapping a blob
 *    between records) is detectable.
 *
 * Keys come from the environment and must be 32-byte values (base64 or hex).
 *   HEALTH_ENCRYPTION_KEY  — AES key
 *   HEALTH_HMAC_KEY        — HMAC key (falls back to a derived key if unset)
 *
 * Never log plaintext or keys. Encrypted blobs are safe to store in the DB.
 */

function loadKey(envName: string, required = true): Buffer | null {
  const raw = process.env[envName];
  if (!raw) {
    if (required && process.env.NODE_ENV === 'production') {
      throw new Error(`${envName} is required in production for clinical data encryption.`);
    }
    if (!required) return null;
    // Dev-only deterministic fallback so the app runs locally without secrets.
    return crypto.createHash('sha256').update(`dev-insecure-${envName}`).digest();
  }
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(`${envName} must decode to 32 bytes (got ${buf.length}).`);
  }
  return buf;
}

const aesKey = () => loadKey('HEALTH_ENCRYPTION_KEY')!;
const hmacKey = () => loadKey('HEALTH_HMAC_KEY', false) ?? aesKey();

/** Encrypt a JSON-serialisable value. Returns a compact `iv.tag.ct` base64 string. */
export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
}

/** Decrypt a blob produced by {@link encryptJson}. Throws if tampered. */
export function decryptJson<T = unknown>(blob: string): T {
  const [ivB64, tagB64, ctB64] = blob.split('.');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Malformed cipher blob.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}

/** Tamper-evidence hash binding the ciphertext to its record metadata. */
export function integrityHash(cipher: string, parts: Record<string, string | number>): string {
  const canonical = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join('&');
  return crypto.createHmac('sha256', hmacKey()).update(`${cipher}|${canonical}`).digest('hex');
}

export function verifyIntegrity(cipher: string, parts: Record<string, string | number>, expected: string): boolean {
  const actual = integrityHash(cipher, parts);
  // Constant-time compare.
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Normalisers + fingerprints for the discount abuse guardrail. */
export const fingerprint = {
  email(email: string): string {
    const [user, domain] = email.trim().toLowerCase().split('@');
    if (!domain) return email.trim().toLowerCase();
    // Gmail-style: ignore dots and +tags so aliases collapse to one identity.
    const isGmail = domain === 'gmail.com' || domain === 'googlemail.com';
    const u = isGmail ? user.replace(/\./g, '').split('+')[0] : user.split('+')[0];
    return `${u}@${domain === 'googlemail.com' ? 'gmail.com' : domain}`;
  },
  phone(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
    return digits.length >= 7 ? digits.slice(-10) : null;
  },
  nameDob(firstName: string, lastName?: string | null, dob?: Date | string | null): string | null {
    if (!dob) return null;
    const d = typeof dob === 'string' ? dob.slice(0, 10) : dob.toISOString().slice(0, 10);
    const name = `${firstName} ${lastName ?? ''}`.trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(`${name}|${d}`).digest('hex').slice(0, 32);
  },
};
