import 'server-only';
import crypto from 'crypto';

// RFC 6238 TOTP + recovery codes, implemented with Node crypto (no external
// dependency). Secrets are base32; the otpauth:// URI works with any
// authenticator app (Google Authenticator, Authy, 1Password, …).

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/,'').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Generate a fresh base32 TOTP secret (160 bits). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** otpauth:// URI for QR codes / manual entry. */
export function totpUri(secret: string, account: string, issuer = 'K Clinics CRM'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return (bin % 1_000_000).toString().padStart(6, '0');
}

/** Verify a 6-digit code against the secret, allowing ±1 time step (clock skew). */
export function verifyTotp(secret: string, code: string): boolean {
  const clean = (code || '').replace(/\D/g, '');
  if (clean.length !== 6) return false;
  const key = base32Decode(secret);
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -1; w <= 1; w++) {
    const expected = hotp(key, step + w);
    // constant-time compare
    if (expected.length === clean.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return true;
  }
  return false;
}

/** Ten human-friendly single-use recovery codes (plain — caller hashes them). */
export function generateRecoveryCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
