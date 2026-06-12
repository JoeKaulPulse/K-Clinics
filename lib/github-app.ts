import 'server-only';
import { createPrivateKey } from 'node:crypto';
import { SignJWT } from 'jose';
import { db } from '@/lib/db';

// GitHub App auth for the Build & Issues board — gives the board its OWN
// GitHub identity (scoped permissions, its own rate limit) instead of sharing
// the personal account's PAT with the dev automation. Configure with:
//   GITHUB_APP_ID               the App's numeric id
//   GITHUB_APP_PRIVATE_KEY      the App's private key PEM (literal \n accepted)
//   GITHUB_APP_INSTALLATION_ID  the installation id on the repo
// When all three are present, getGithubConfig() (lib/build-board.ts) prefers
// this identity over GITHUB_TOKEN / the saved PAT connection automatically.
//
// Flow: sign a short-lived RS256 App JWT → exchange it for an installation
// access token (valid 1h) → cache it in Settings and refresh ~10 min early.

const TOKEN_KEY = 'github_app_token'; // Settings cache: { token, expiresAt }
const EARLY_REFRESH_MS = 10 * 60 * 1000;

export function githubAppConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY && process.env.GITHUB_APP_INSTALLATION_ID);
}

/** Short-lived App JWT (GitHub caps validity at 10 minutes). */
async function appJwt(): Promise<string> {
  // Env UIs often store the PEM with literal "\n" — restore real newlines.
  // node:crypto accepts both PKCS#1 (GitHub's download format) and PKCS#8.
  const pem = process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const key = createPrivateKey(pem);
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 30) // small clock-drift allowance
    .setExpirationTime(now + 9 * 60)
    .setIssuer(process.env.GITHUB_APP_ID!)
    .sign(key);
}

/** A valid installation access token, from cache or freshly minted. */
export async function githubAppToken(): Promise<string | null> {
  if (!githubAppConfigured()) return null;
  try {
    const cached = await db.setting.findUnique({ where: { key: TOKEN_KEY } }).catch(() => null);
    if (cached?.value) {
      const { token, expiresAt } = JSON.parse(cached.value) as { token?: string; expiresAt?: number };
      if (token && expiresAt && expiresAt - Date.now() > EARLY_REFRESH_MS) return token;
    }

    const res = await fetch(`https://api.github.com/app/installations/${process.env.GITHUB_APP_INSTALLATION_ID}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await appJwt()}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'kclinics-build-board',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('[github-app] installation token request failed:', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const d = (await res.json()) as { token?: string; expires_at?: string };
    if (!d.token) return null;
    const expiresAt = d.expires_at ? +new Date(d.expires_at) : Date.now() + 55 * 60 * 1000;
    const value = JSON.stringify({ token: d.token, expiresAt });
    await db.setting.upsert({ where: { key: TOKEN_KEY }, update: { value, updatedBy: 'system' }, create: { key: TOKEN_KEY, value, updatedBy: 'system' } }).catch(() => {});
    return d.token;
  } catch (e) {
    console.error('[github-app] token mint failed:', (e as Error).message);
    return null;
  }
}
