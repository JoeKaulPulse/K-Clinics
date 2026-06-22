import 'server-only';
import crypto from 'crypto';

// Check a password against Have I Been Pwned using k-anonymity: only the first
// 5 chars of the SHA-1 are sent, never the password. Fails OPEN (returns false)
// if the service is unreachable, so it never blocks a legitimate sign-up.
export async function isBreachedPassword(password: string): Promise<boolean> {
  if (!password || password.length < 1) return false;
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    // prefix is always 5 uppercase hex chars from SHA-1 — validate explicitly so
    // static analysis tools understand the value is sanitised for URL use.
    if (!/^[0-9A-F]{5}$/.test(prefix)) return false;
    const res = await fetch(`https://api.pwnedpasswords.com/range/${encodeURIComponent(prefix)}`, {
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const text = await res.text();
    for (const line of text.split('\n')) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false; // fail-open
  }
}
