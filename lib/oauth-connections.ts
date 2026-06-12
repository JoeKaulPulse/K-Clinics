import 'server-only';
import { db } from '@/lib/db';
import { encryptJson, decryptJson } from '@/lib/crypto';

// Store/refresh OAuth tokens for external services (Xero, TrueLayer). Tokens are
// encrypted at rest. Each provider has one connection row.

export type Tokens = { access: string; refresh?: string; expiresAt: number | null };

export async function saveConnection(provider: string, tokens: Tokens, accountRef?: string | null, label?: string | null) {
  const tokensEnc = encryptJson(tokens);
  await db.externalConnection.upsert({
    where: { provider },
    update: { tokensEnc, ...(accountRef !== undefined ? { accountRef } : {}), ...(label !== undefined ? { label } : {}) },
    create: { provider, tokensEnc, accountRef: accountRef ?? null, label: label ?? null },
  });
}

/** Tolerate rows saved before the marketing OAuth callback normalised token
 *  shapes: a raw provider response ({access_token, expires_in, …}, sometimes
 *  nested under `data` for TikTok) is mapped onto the canonical Tokens shape
 *  so existing connections keep working without a forced reconnect. */
function normalizeTokens(stored: unknown): Tokens | null {
  if (!stored || typeof stored !== 'object') return null;
  const t = stored as Record<string, unknown>;
  if (typeof t.access === 'string') return t as unknown as Tokens;
  const raw = (t.data && typeof t.data === 'object' ? t.data : t) as Record<string, unknown>;
  if (typeof raw.access_token !== 'string') return null;
  return {
    access: raw.access_token,
    refresh: typeof raw.refresh_token === 'string' ? raw.refresh_token : undefined,
    // expires_in was relative to issue time, which we no longer know — treat as
    // unknown expiry; a failing call then surfaces as "reconnect" in the UI.
    expiresAt: null,
  };
}

export async function getConnection(provider: string): Promise<{ tokens: Tokens; accountRef: string | null; label: string | null } | null> {
  const row = await db.externalConnection.findUnique({ where: { provider } });
  if (!row) return null;
  try {
    const tokens = normalizeTokens(decryptJson<unknown>(row.tokensEnc));
    if (!tokens) return null;
    return { tokens, accountRef: row.accountRef, label: row.label };
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

/** Return a valid access token, refreshing via `refresh` if expired. */
export async function validAccessToken(
  provider: string,
  refresh: (refreshToken: string) => Promise<Tokens | null>,
): Promise<string | null> {
  const conn = await getConnection(provider);
  if (!conn) return null;
  const { tokens } = conn;
  const fresh = !tokens.expiresAt || tokens.expiresAt - 60_000 > Date.now();
  if (fresh) return tokens.access;
  if (!tokens.refresh) return null;
  const next = await refresh(tokens.refresh);
  if (!next) return null;
  await saveConnection(provider, next, conn.accountRef, conn.label);
  return next.access;
}
