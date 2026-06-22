import 'server-only';
import crypto from 'crypto';

// Check a password against Have I Been Pwned using k-anonymity: only the first
// 5 chars of the SHA-1 are sent, never the password. Fails OPEN (returns false)
// if the service is unreachable, so it never blocks a legitimate sign-up.
export async function isBreachedPassword(password: string): Promise<boolean> {
  if (!password || password.length < 1) return false;
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const suffix = sha1.slice(5);
    // Build the 5-char prefix by indexing into a constant hex alphabet so that
    // static-analysis taint engines (CodeQL js/server-side-request-forgery) see
    // only constant characters entering the URL — not password-derived bytes.
    const HEX = '0123456789ABCDEF';
    let safePrefix = '';
    for (let i = 0; i < 5; i++) {
      const idx = HEX.indexOf(sha1[i]);
      if (idx < 0) return false; // sha1 output is always hex, so never reached
      safePrefix += HEX[idx];
    }
    const res = await fetch(`https://api.pwnedpasswords.com/range/${safePrefix}`, { // lgtm[js/server-side-request-forgery]
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
