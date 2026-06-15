import 'server-only';
import { randomBytes } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { getSecret } from '@/lib/secrets';

// Google Workspace Directory API client (BLD-312, Phase A — READ-ONLY).
//
// Authenticates as a service account with domain-wide delegation, impersonating a
// super-admin, and lists users, groups and aliases for the dashboard. Hand-rolled
// JWT-bearer flow (signed with jose) to match lib/google-auth.ts's fetch-based
// style — no googleapis SDK. Inert until credentialed: every export returns a safe
// empty/parked result when the service-account key + admin email aren't set, so the
// feature stays dormant (the platform's inert-until-credentialed pattern).
//
// Setup runbook: docs/WORKSPACE_ADMIN_SDK_SETUP.md.

const DIRECTORY = 'https://admin.googleapis.com/admin/directory/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Phase A scopes — read-only. Phase B (provisioning) adds the writable equivalents
// and the same Client ID must be re-authorised for them in domain-wide delegation.
const READONLY_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
];

// Phase B (provisioning). The same Client ID must be authorised for these in
// domain-wide delegation before writes succeed (the page surfaces a clear hint
// if not). Kept separate from the read scopes so a read-only install still works.
const WRITE_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.user.alias',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.group.member',
];

type ServiceAccountKey = { client_email?: string; private_key?: string; token_uri?: string };

export type WorkspaceUser = {
  id: string;
  email: string;
  name: string;
  suspended: boolean;
  admin: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  orgUnitPath: string | null;
  aliases: string[];
};

export type WorkspaceGroup = {
  id: string;
  email: string;
  name: string;
  description: string;
  memberCount: number | null;
  aliases: string[];
};

export type WorkspaceOverview = {
  /** True once a service-account key + admin email are present. */
  configured: boolean;
  /** True when Google accepted the credentials and returned data. */
  ok: boolean;
  /** Human-readable reason when configured but the call failed (setup hints). */
  error?: string;
  /** The super-admin the service account impersonates. */
  adminEmail?: string;
  users: WorkspaceUser[];
  groups: WorkspaceGroup[];
};

/** Present once the service-account key + impersonated admin are configured. */
export async function workspaceConfigured(): Promise<boolean> {
  const [key, admin] = await Promise.all([
    getSecret('GOOGLE_WORKSPACE_SA_KEY'),
    getSecret('GOOGLE_WORKSPACE_ADMIN_EMAIL'),
  ]);
  return Boolean(key && admin);
}

async function loadKey(): Promise<{ sa: ServiceAccountKey; adminEmail: string } | null> {
  const [raw, adminEmail] = await Promise.all([
    getSecret('GOOGLE_WORKSPACE_SA_KEY'),
    getSecret('GOOGLE_WORKSPACE_ADMIN_EMAIL'),
  ]);
  if (!raw || !adminEmail) return null;
  let sa: ServiceAccountKey;
  try { sa = JSON.parse(raw) as ServiceAccountKey; } catch { return null; }
  if (!sa.client_email || !sa.private_key) return null;
  return { sa, adminEmail };
}

// Access tokens last ~1h; cache per scope-set/admin/key so we don't re-sign on
// every request. Refreshed a minute before expiry.
let tokenCache: { token: string; exp: number; key: string } | null = null;

async function directoryToken(scopes: string[] = READONLY_SCOPES): Promise<{ token?: string; error?: string }> {
  const loaded = await loadKey();
  if (!loaded) return { error: 'Service-account key or admin email not set.' };
  const { sa, adminEmail } = loaded;
  const cacheKey = `${scopes.join(' ')}|${adminEmail}|${sa.client_email}`;
  if (tokenCache && tokenCache.key === cacheKey && tokenCache.exp - 60_000 > Date.now()) {
    return { token: tokenCache.token };
  }
  try {
    const pk = await importPKCS8(sa.private_key as string, 'RS256');
    const assertion = await new SignJWT({ scope: scopes.join(' ') })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(sa.client_email as string)
      .setSubject(adminEmail) // impersonate the super-admin (domain-wide delegation)
      .setAudience(sa.token_uri || TOKEN_URL)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(pk);
    const res = await fetch(sa.token_uri || TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
    if (!res.ok || !j?.access_token) {
      return { error: hint(String(j?.error_description || j?.error || `HTTP ${res.status}`)) };
    }
    tokenCache = {
      token: j.access_token,
      exp: Date.now() + (Number(j.expires_in) || 3600) * 1000,
      key: cacheKey,
    };
    return { token: tokenCache.token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not sign the service-account token.' };
  }
}

async function directoryGet<T>(path: string, scopes?: string[]): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const tok = await directoryToken(scopes);
  if (!tok.token) return { ok: false, error: tok.error || 'Not configured.' };
  let res: Response;
  try {
    res = await fetch(`${DIRECTORY}${path}`, {
      headers: { authorization: `Bearer ${tok.token}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error contacting Google.' };
  }
  const j = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok) {
    return { ok: false, error: hint(String(j?.error?.message || `HTTP ${res.status}`)) };
  }
  return { ok: true, data: (j || {}) as T };
}

// Phase B write transport. Always requests WRITE_SCOPES (a separate cached token
// from the read path). DELETE/empty responses (204) are treated as success.
async function directoryWrite<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const tok = await directoryToken(WRITE_SCOPES);
  if (!tok.token) return { ok: false, error: tok.error || 'Not configured.' };
  let res: Response;
  try {
    res = await fetch(`${DIRECTORY}${path}`, {
      method,
      headers: { authorization: `Bearer ${tok.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error contacting Google.' };
  }
  if (res.status === 204) return { ok: true, data: {} as T };
  const j = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok) return { ok: false, error: hint(String(j?.error?.message || `HTTP ${res.status}`)) };
  return { ok: true, data: (j || {}) as T };
}

// Turn Google's terse errors into actionable setup guidance — the most common
// failures during first-time service-account/delegation setup.
function hint(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('unauthorized_client') || r.includes('not authorized') || r.includes('unauthorized'))
    return 'Google rejected the service account: domain-wide delegation is not authorised for these scopes yet. In the Admin console → Security → Access and data control → API controls → Domain-wide delegation, add the service account’s Client ID with the admin.directory.user.readonly and admin.directory.group.readonly scopes.';
  if (r.includes('invalid_grant'))
    return 'Google rejected the sign-in (invalid_grant). Check GOOGLE_WORKSPACE_ADMIN_EMAIL is a real super-admin in this Workspace, and that the service-account key is current.';
  if (r.includes('access_denied') || r.includes('forbidden') || r.includes('403'))
    return 'Access denied (403). The impersonated admin may lack directory rights, or the Admin SDK API is not enabled on the Cloud project (APIs & Services → Enable “Admin SDK API”).';
  if (r.includes('not found') || r.includes('404'))
    return 'Not found (404) — check GOOGLE_WORKSPACE_CUSTOMER_ID, or leave it unset to use “my_customer”.';
  return reason;
}

type DirUser = { id?: string; primaryEmail?: string; name?: { fullName?: string }; suspended?: boolean; isAdmin?: boolean; isDelegatedAdmin?: boolean; lastLoginTime?: string; creationTime?: string; orgUnitPath?: string; aliases?: string[] };
type DirGroup = { id?: string; email?: string; name?: string; description?: string; directMembersCount?: string; aliases?: string[] };

function mapUser(u: DirUser): WorkspaceUser {
  // Google returns the Unix epoch for "never signed in"; treat that as null.
  const last = u.lastLoginTime && !u.lastLoginTime.startsWith('1970') ? u.lastLoginTime : null;
  return {
    id: u.id || u.primaryEmail || '',
    email: u.primaryEmail || '',
    name: u.name?.fullName || '',
    suspended: Boolean(u.suspended),
    admin: Boolean(u.isAdmin || u.isDelegatedAdmin),
    lastLoginAt: last,
    createdAt: u.creationTime || null,
    orgUnitPath: u.orgUnitPath || null,
    aliases: Array.isArray(u.aliases) ? u.aliases : [],
  };
}

async function customer(): Promise<string> {
  return (await getSecret('GOOGLE_WORKSPACE_CUSTOMER_ID')) || 'my_customer';
}

export async function listWorkspaceUsers(): Promise<{ ok: boolean; users: WorkspaceUser[]; error?: string }> {
  const cust = await customer();
  const users: WorkspaceUser[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ customer: cust, maxResults: '200', orderBy: 'email', projection: 'full' });
    if (pageToken) qs.set('pageToken', pageToken);
    const r = await directoryGet<{ users?: DirUser[]; nextPageToken?: string }>(`/users?${qs.toString()}`);
    if (!r.ok) return { ok: false, users: [], error: r.error };
    for (const u of r.data.users || []) users.push(mapUser(u));
    pageToken = r.data.nextPageToken;
  } while (pageToken && users.length < 2000);
  return { ok: true, users };
}

export async function listWorkspaceGroups(): Promise<{ ok: boolean; groups: WorkspaceGroup[]; error?: string }> {
  const cust = await customer();
  const groups: WorkspaceGroup[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ customer: cust, maxResults: '200' });
    if (pageToken) qs.set('pageToken', pageToken);
    const r = await directoryGet<{ groups?: DirGroup[]; nextPageToken?: string }>(`/groups?${qs.toString()}`);
    if (!r.ok) return { ok: false, groups: [], error: r.error };
    for (const g of r.data.groups || []) {
      const n = Number(g.directMembersCount);
      groups.push({
        id: g.id || g.email || '',
        email: g.email || '',
        name: g.name || '',
        description: g.description || '',
        memberCount: Number.isFinite(n) ? n : null,
        aliases: Array.isArray(g.aliases) ? g.aliases : [],
      });
    }
    pageToken = r.data.nextPageToken;
  } while (pageToken && groups.length < 2000);
  return { ok: true, groups };
}

/** Everything the /admin/workspace page needs in one call. Safe when unconfigured. */
export async function getWorkspaceOverview(): Promise<WorkspaceOverview> {
  if (!(await workspaceConfigured())) {
    return { configured: false, ok: false, users: [], groups: [] };
  }
  const adminEmail = (await getSecret('GOOGLE_WORKSPACE_ADMIN_EMAIL')) || undefined;
  const [u, g] = await Promise.all([listWorkspaceUsers(), listWorkspaceGroups()]);
  return {
    configured: true,
    ok: u.ok && g.ok,
    error: u.error || g.error,
    adminEmail,
    users: u.users,
    groups: g.groups,
  };
}

// ── Provisioning (BLD-312 Phase B) ─────────────────────────────────────────
// Gated + audited at the action layer (app/admin/workspace/actions.ts). No hard
// delete is exposed — suspend is the reversible, no-data-loss control.

const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// One-time temporary password (mixed classes, shuffled); user must change it at
// first login. Returned once to the caller to hand over — never stored or logged.
function genPassword(): string {
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789', S = '!@#$%^*-_';
  const all = U + L + D + S;
  const b = randomBytes(24);
  const at = (s: string, i: number) => s[b[i] % s.length];
  const chars = [at(U, 0), at(L, 1), at(D, 2), at(S, 3)];
  for (let i = 4; i < 20; i++) chars.push(at(all, i));
  for (let i = chars.length - 1; i > 0; i--) { const j = b[(i + 3) % b.length] % (i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

export async function createWorkspaceUser(input: { email: string; firstName: string; lastName: string }): Promise<{ ok: boolean; user?: WorkspaceUser; tempPassword?: string; error?: string }> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!emailOk(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!firstName || !lastName) return { ok: false, error: 'First and last name are both required.' };
  const password = genPassword();
  const r = await directoryWrite<DirUser>('POST', '/users', {
    primaryEmail: email,
    name: { givenName: firstName, familyName: lastName },
    password,
    changePasswordAtNextLogin: true,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, user: mapUser(r.data), tempPassword: password };
}

export async function setWorkspaceUserSuspended(email: string, suspended: boolean): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase();
  if (!emailOk(e)) return { ok: false, error: 'Invalid email.' };
  const r = await directoryWrite<DirUser>('PATCH', `/users/${encodeURIComponent(e)}`, { suspended });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function addUserAlias(email: string, alias: string): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase(), a = alias.trim().toLowerCase();
  if (!emailOk(e) || !emailOk(a)) return { ok: false, error: 'Enter valid email addresses.' };
  const r = await directoryWrite<unknown>('POST', `/users/${encodeURIComponent(e)}/aliases`, { alias: a });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function removeUserAlias(email: string, alias: string): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase(), a = alias.trim().toLowerCase();
  if (!emailOk(e) || !emailOk(a)) return { ok: false, error: 'Invalid email.' };
  const r = await directoryWrite<unknown>('DELETE', `/users/${encodeURIComponent(e)}/aliases/${encodeURIComponent(a)}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function createWorkspaceGroup(input: { email: string; name: string; description?: string }): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!emailOk(email)) return { ok: false, error: 'Enter a valid group email address.' };
  if (!name) return { ok: false, error: 'Give the group a name.' };
  const r = await directoryWrite<DirGroup>('POST', '/groups', { email, name, description: (input.description || '').trim() || undefined });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function addGroupMember(groupEmail: string, memberEmail: string): Promise<{ ok: boolean; error?: string }> {
  const g = groupEmail.trim().toLowerCase(), m = memberEmail.trim().toLowerCase();
  if (!emailOk(g) || !emailOk(m)) return { ok: false, error: 'Enter valid email addresses.' };
  const r = await directoryWrite<unknown>('POST', `/groups/${encodeURIComponent(g)}/members`, { email: m, role: 'MEMBER' });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function removeGroupMember(groupEmail: string, memberEmail: string): Promise<{ ok: boolean; error?: string }> {
  const g = groupEmail.trim().toLowerCase(), m = memberEmail.trim().toLowerCase();
  if (!emailOk(g) || !emailOk(m)) return { ok: false, error: 'Invalid email.' };
  const r = await directoryWrite<unknown>('DELETE', `/groups/${encodeURIComponent(g)}/members/${encodeURIComponent(m)}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
