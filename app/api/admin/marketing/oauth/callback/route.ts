import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// OAuth callback for all marketing platforms: verify state, exchange the code for
// tokens, store them (encrypted), and return to the connections page.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (q: string) => NextResponse.redirect(new URL(`/admin/marketing/connections?${q}`, req.url));
  if (!crmEnabled) return to('error=disabled');

  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return to('error=forbidden');

  const providerId = url.searchParams.get('provider') || '';
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error')) return to(`error=${providerId}_denied`);
  if (!code || !state) return to(`error=${providerId}_no_code`);

  const { cookies } = await import('next/headers');
  const jar = await cookies();
  // BLD-130: timing-safe comparison prevents CSRF-state oracle timing attacks.
  const storedState = jar.get('kc_oauth_state')?.value ?? '';
  const stateMatch = storedState.length === state.length && timingSafeEqual(Buffer.from(storedState), Buffer.from(state));
  if (!storedState || !stateMatch) return to(`error=${providerId}_bad_state`);
  // Bind the state to the provider it was minted for. The state is `${id}.${nonce}`
  // (connect/route.ts), so a state issued for provider A must not be honoured on a
  // callback that claims provider B — otherwise A's code/cookie is exchanged at B.
  if (!state.startsWith(`${providerId}.`)) return to(`error=${providerId}_bad_state`);

  const { getProvider, isConfigured, REDIRECT_URI } = await import('@/lib/marketing-connections');
  const p = getProvider(providerId);
  if (!p || !(await isConfigured(p))) return to(`error=${providerId}_not_configured`);

  try {
    const { getSecret } = await import('@/lib/secrets');
    const form = new URLSearchParams({
      client_id: (await getSecret(p.envClientId)) || '',
      client_secret: (await getSecret(p.envClientSecret)) || '',
      redirect_uri: `${REDIRECT_URI}?provider=${p.id}`,
      grant_type: 'authorization_code',
      code,
    });
    const res = await fetch(p.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: form, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) { console.error('[marketing-oauth]', p.id, res.status, await res.text().catch(() => '')); return to(`error=${p.id}_token`); }
    const raw = await res.json();

    // BLD-278: normalise the provider response (access_token/expires_in) to our
    // Tokens shape — previously the raw JSON was stored, so tokens.access was
    // always undefined and the connection silently never worked.
    const { saveConnection, normalizeTokens } = await import('@/lib/oauth-connections');
    await saveConnection(p.id, normalizeTokens(raw), null, p.name);
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Connected ${p.name}` });
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/admin/marketing/connections');
    return to(`connected=${p.id}`);
  } catch (e) {
    console.error('[marketing-oauth] exchange failed', (e as Error)?.message);
    return to(`error=${p.id}_exchange`);
  }
}
