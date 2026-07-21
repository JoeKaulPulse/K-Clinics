import 'server-only';
import { db } from '@/lib/db';
import { encryptJson, decryptJson } from '@/lib/crypto';

// Store/refresh OAuth tokens for external services (Xero, TrueLayer). Tokens are
// encrypted at rest. Each provider has one connection row.

export type Tokens = { access: string; refresh?: string; expiresAt: number | null };

// BLD-278: providers return tokens as { access_token, refresh_token, expires_in }.
// Some callers used to persist that raw shape, leaving `tokens.access` undefined
// (so every read failed silently). Normalise to our Tokens shape — accepting both
// the raw provider form and the already-normalised form — on write AND on read,
// so existing rows self-heal without a migration.
export function normalizeTokens(raw: unknown): Tokens {
  let t = (raw ?? {}) as Record<string, unknown>;
  // TikTok wraps its token response in an envelope: { code, message, data: {…} }.
  if (!t.access && !t.access_token && t.data && typeof t.data === 'object') t = t.data as Record<string, unknown>;
  const access = String(t.access ?? t.access_token ?? '');
  const refresh = (t.refresh ?? t.refresh_token) as string | undefined;
  let expiresAt: number | null = null;
  if (typeof t.expiresAt === 'number') expiresAt = t.expiresAt;
  else if (t.expires_in != null && !Number.isNaN(Number(t.expires_in))) expiresAt = Date.now() + Number(t.expires_in) * 1000;
  return { access, refresh: refresh || undefined, expiresAt };
}

export async function saveConnection(provider: string, tokens: Tokens, accountRef?: string | null, label?: string | null) {
  const tokensEnc = encryptJson(tokens);
  await db.externalConnection.upsert({
    where: { provider },
    update: { tokensEnc, ...(accountRef !== undefined ? { accountRef } : {}), ...(label !== undefined ? { label } : {}) },
    create: { provider, tokensEnc, accountRef: accountRef ?? null, label: label ?? null },
  });
}

export async function getConnection(provider: string): Promise<{ tokens: Tokens; accountRef: string | null; label: string | null } | null> {
  const row = await db.externalConnection.findUnique({ where: { provider } });
  if (!row) return null;
  try {
    // Tolerant read: normalise so any legacy raw-provider rows still resolve.
    return { tokens: normalizeTokens(decryptJson<unknown>(row.tokensEnc)), accountRef: row.accountRef, label: row.label };
  } catch {
    return null;
  }
}

export async function isConnected(provider: string): Promise<boolean> {
  return (await db.externalConnection.count({ where: { provider } })) > 0;
}

export async function disconnect(provider: string) {
  await db.externalConnection.deleteMany({ where: { provider } });
}

/** Return a valid access token, refreshing via `refresh` if expired.
 *  `forceRefresh` skips the freshness check and refreshes unconditionally — used
 *  to recover from a token that *looks* fresh but the API rejected (401): some
 *  legacy connection rows store the raw `expires_in` rather than an absolute
 *  `expiresAt`, so their expiry is recomputed as "now + expires_in" on every read
 *  and the stale access token never refreshes on its own. */
export async function validAccessToken(
  provider: string,
  refresh: (refreshToken: string) => Promise<Tokens | null>,
  opts?: { forceRefresh?: boolean },
): Promise<string | null> {
  const conn = await getConnection(provider);
  if (!conn) return null;
  const { tokens } = conn;
  const fresh = !opts?.forceRefresh && (!tokens.expiresAt || tokens.expiresAt - 60_000 > Date.now());
  if (fresh) return tokens.access;
  if (!tokens.refresh) return null;
  const next = await refresh(tokens.refresh);
  if (!next) return null;
  await saveConnection(provider, next, conn.accountRef, conn.label);
  return next.access;
}
