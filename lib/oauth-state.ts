import 'server-only';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

// CSRF protection for OAuth authorization-code flows. The connect route mints a
// random state, stores it in an httpOnly cookie, and sends it to the provider;
// the callback must present a state that matches the cookie. Without this an
// attacker could trick an admin into completing an OAuth flow they initiated
// (connecting the clinic's books/bank feed to the attacker's account).

const TTL = 600; // seconds — the OAuth round-trip is short-lived.

function cookieName(key: string) {
  return `kc_oauth_state_${key}`;
}

// Mint a random state nonce to embed in the provider authorization URL.
export function newOAuthState(key: string): string {
  return `${key}.${randomUUID()}`;
}

// Attach the state cookie to a redirect response built for the given state.
export function attachOAuthState(res: NextResponse, key: string, state: string): NextResponse {
  res.cookies.set(cookieName(key), state, {
    httpOnly: true,
    sameSite: 'lax', // 'lax' so the cookie survives the top-level redirect back from the provider.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL,
  });
  return res;
}

// Validate the callback's state against the cookie using a timing-safe compare,
// then clear the one-time cookie. Returns true only on an exact match.
export async function consumeOAuthState(key: string, received: string | null): Promise<boolean> {
  const jar = await cookies();
  const name = cookieName(key);
  const stored = jar.get(name)?.value || '';
  // Always clear so a state can't be replayed.
  jar.delete(name);
  if (!received || !stored) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}
