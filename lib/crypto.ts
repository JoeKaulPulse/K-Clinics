import 'server-only';
import crypto from 'crypto';

/**
 * App-level encryption for sensitive clinical data (health assessments, clinical
 * notes, OAuth tokens) with a VERSIONED KEYRING for safe key rotation.
 *
 *  • Confidentiality: AES-256-GCM, per-record random IV.
 *  • Integrity: GCM auth tag + a separate HMAC-SHA256 over ciphertext + bound
 *    metadata, so tampering (incl. swapping a blob between records) is caught.
 *  • Rotation: every blob is tagged with the id of the key that wrote it
 *    (`keyId.iv.tag.ct`). The active key encrypts new data; ANY key in the ring
 *    can decrypt old data — so adding a new key never makes old data unreadable.
 *
 * Env (32-byte values, hex or base64):
 *   HEALTH_ENCRYPTION_KEY        — active AES key (used for new writes)
 *   HEALTH_ENCRYPTION_KEYS_OLD   — optional, comma-separated retired AES keys
 *                                  (kept so old records still decrypt during/after rotation)
 *   HEALTH_HMAC_KEY              — active HMAC key (defaults to the AES ring if unset)
 *   HEALTH_HMAC_KEYS_OLD         — optional, comma-separated retired HMAC keys
 *
 * To rotate: move the current HEALTH_ENCRYPTION_KEY value into
 * HEALTH_ENCRYPTION_KEYS_OLD, set HEALTH_ENCRYPTION_KEY to a new key, redeploy.
 * The daily re-encryption sweep (lib/key-rotation) migrates old records to the
 * new key; once it reports 0 remaining, remove the old key from the env.
 *
 * Never log plaintext or keys.
 */

type Keyed = { id: string; key: Buffer };

const keyId = (key: Buffer) => crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);

function decode(raw: string): Buffer | null {
  const t = raw.trim();
  if (!t) return null;
  const buf = /^[0-9a-f]{64}$/i.test(t) ? Buffer.from(t, 'hex') : Buffer.from(t, 'base64');
  return buf.length === 32 ? buf : null;
}

function decodeStrict(envName: string, raw: string): Buffer {
  const b = decode(raw);
  if (!b) throw new Error(`${envName} must decode to 32 bytes (hex or base64).`);
  return b;
}

function loadActive(envName: string): Buffer {
  const raw = process.env[envName];
  if (raw) return decodeStrict(envName, raw);
  if (process.env.NODE_ENV === 'production') throw new Error(`${envName} is required in production for clinical data encryption.`);
  // Dev-only deterministic fallback so the app runs locally without secrets.
  return crypto.createHash('sha256').update(`dev-insecure-${envName}`).digest();
}

function loadList(envName: string): Buffer[] {
  const raw = process.env[envName];
  if (!raw) return [];
  return raw.split(',').map((s) => decode(s)).filter((b): b is Buffer => !!b);
}

function dedup(keys: Buffer[]): Keyed[] {
  const seen = new Set<string>();
  const ring: Keyed[] = [];
  for (const k of keys) {
    const id = keyId(k);
    if (!seen.has(id)) { seen.add(id); ring.push({ id, key: k }); }
  }
  return ring;
}

// AES ring: active key first (used for encryption), then any retired keys.
function aesRing(): Keyed[] {
  return dedup([loadActive('HEALTH_ENCRYPTION_KEY'), ...loadList('HEALTH_ENCRYPTION_KEYS_OLD')]);
}

// HMAC ring. When HEALTH_HMAC_KEY is unset we fall back to the AES ring (matches
// historical behaviour where the AES key doubled as the HMAC key).
function hmacRing(): Keyed[] {
  const raw = process.env.HEALTH_HMAC_KEY;
  if (!raw) return aesRing();
  return dedup([decodeStrict('HEALTH_HMAC_KEY', raw), ...loadList('HEALTH_HMAC_KEYS_OLD')]);
}

/** The id of the key new data is encrypted with. */
export function activeKeyId(): string {
  return aesRing()[0].id;
}

/** True if a blob was written with the current active key (used by the sweep). */
export function isOnActiveKey(blob: string): boolean {
  const parts = blob.split('.');
  return parts.length === 4 && parts[0] === activeKeyId();
}

/** Encrypt a JSON-serialisable value → `keyId.iv.tag.ct` (base64 parts). */
export function encryptJson(value: unknown): string {
  const active = aesRing()[0];
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', active.key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [active.id, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
}

/** Decrypt a blob from {@link encryptJson} (or a legacy un-tagged blob). Tries
 *  the tagged key first, then every key in the ring. Throws if none match. */
export function decryptJson<T = unknown>(blob: string): T {
  const parts = blob.split('.');
  let preferId: string | undefined;
  let ivB64: string, tagB64: string, ctB64: string;
  if (parts.length === 4) { [preferId, ivB64, tagB64, ctB64] = parts; }
  else if (parts.length === 3) { [ivB64, tagB64, ctB64] = parts; } // legacy (pre-keyring)
  else throw new Error('Malformed cipher blob.');

  const ring = aesRing();
  const ordered = preferId ? [...ring.filter((k) => k.id === preferId), ...ring.filter((k) => k.id !== preferId)] : ring;
  for (const k of ordered) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', k.key, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]);
      return JSON.parse(pt.toString('utf8')) as T;
    } catch { /* try the next key */ }
  }
  throw new Error('Unable to decrypt: no matching key in the ring.');
}

function hmacWith(key: Buffer, cipher: string, parts: Record<string, string | number>): string {
  const canonical = Object.keys(parts).sort().map((k) => `${k}=${parts[k]}`).join('&');
  return crypto.createHmac('sha256', key).update(`${cipher}|${canonical}`).digest('hex');
}

/** Tamper-evidence hash binding the ciphertext to its record metadata (active key). */
export function integrityHash(cipher: string, parts: Record<string, string | number>): string {
  return hmacWith(hmacRing()[0].key, cipher, parts);
}

/** Verify against any key in the HMAC ring (so old hashes survive rotation). */
export function verifyIntegrity(cipher: string, parts: Record<string, string | number>, expected: string): boolean {
  const b = Buffer.from(expected);
  for (const k of hmacRing()) {
    const a = Buffer.from(hmacWith(k.key, cipher, parts));
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Normalisers + fingerprints for the discount abuse guardrail. */
export const fingerprint = {
  email(email: string): string {
    const [user, domain] = email.trim().toLowerCase().split('@');
    if (!domain) return email.trim().toLowerCase();
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
