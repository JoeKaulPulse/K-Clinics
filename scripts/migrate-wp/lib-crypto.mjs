// Encryption for migrated clinical records — a faithful re-implementation of
// the active-key path of lib/crypto.ts, so blobs written here decrypt and
// verify inside the app. Reads the same env vars (HEALTH_ENCRYPTION_KEY,
// HEALTH_HMAC_KEY). Keep these identical to production for the import to land
// on the same keyring.

import crypto from 'node:crypto';

function decode(raw) {
  const t = String(raw).trim();
  if (!t) return null;
  const buf = /^[0-9a-f]{64}$/i.test(t) ? Buffer.from(t, 'hex') : Buffer.from(t, 'base64');
  return buf.length === 32 ? buf : null;
}
function decodeStrict(env, raw) {
  const b = decode(raw);
  if (!b) throw new Error(`${env} must decode to 32 bytes (hex or base64).`);
  return b;
}
function loadActive(env) {
  const raw = process.env[env];
  if (raw) return decodeStrict(env, raw);
  if (process.env.NODE_ENV === 'production') throw new Error(`${env} is required in production for clinical data encryption.`);
  return crypto.createHash('sha256').update(`dev-insecure-${env}`).digest();
}
const keyId = (key) => crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);
const aesKey = () => loadActive('HEALTH_ENCRYPTION_KEY');
const hmacKey = () => { const raw = process.env.HEALTH_HMAC_KEY; return raw ? decodeStrict('HEALTH_HMAC_KEY', raw) : aesKey(); };

/** Encrypt → `keyId.iv.tag.ct` (base64 parts), matching encryptJson(). */
export function encryptJson(value) {
  const key = aesKey();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(value), 'utf8')), c.final()]);
  return [keyId(key), iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}

/** Decrypt a blob (used only for the round-trip self-test). */
export function decryptJson(blob) {
  const parts = blob.split('.');
  let ivB, tagB, ctB;
  if (parts.length === 4) [, ivB, tagB, ctB] = parts;
  else if (parts.length === 3) [ivB, tagB, ctB] = parts;
  else throw new Error('Malformed cipher blob.');
  const d = crypto.createDecipheriv('aes-256-gcm', aesKey(), Buffer.from(ivB, 'base64'));
  d.setAuthTag(Buffer.from(tagB, 'base64'));
  const pt = Buffer.concat([d.update(Buffer.from(ctB, 'base64')), d.final()]);
  return JSON.parse(pt.toString('utf8'));
}

/** Tamper-evidence hash binding ciphertext to record metadata (matches integrityHash()). */
export function integrityHash(cipher, parts) {
  const canonical = Object.keys(parts).sort().map((k) => `${k}=${parts[k]}`).join('&');
  return crypto.createHmac('sha256', hmacKey()).update(`${cipher}|${canonical}`).digest('hex');
}
