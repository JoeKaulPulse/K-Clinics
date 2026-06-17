import 'server-only';
import { SignJWT, importPKCS8 } from 'jose';
import { getSecret } from '@/lib/secrets';

// Google Workspace Directory API integration via service account + domain-wide
// delegation (DWD). The service account impersonates a designated super-admin to
// call the Admin SDK. No per-request user OAuth — one short-TTL access token per
// scope set, cached in-process.
//
// Setup: see docs/GOOGLE_WORKSPACE_MIGRATION.md §10.1.
// Credentials stored via setSecret: GOOGLE_WORKSPACE_SA_KEY (JSON),
// GOOGLE_WORKSPACE_ADMIN_EMAIL, GOOGLE_WORKSPACE_CUSTOMER_ID (optional).

// In-process token cache keyed by scope string.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function workspaceConfigured(): Promise<boolean> {
  const [key, admin] = await Promise.all([
    getSecret('GOOGLE_WORKSPACE_SA_KEY'),
    getSecret('GOOGLE_WORKSPACE_ADMIN_EMAIL'),
  ]);
  return Boolean(key && admin);
}

const READ_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
].join(' ');

const WRITE_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.user.alias',
  'https://www.googleapis.com/auth/admin.directory.group.member',
].join(' ');

// Map Google's terse token/API errors to actionable setup guidance — the common
// first-time failures (delegation not authorised, Admin SDK off, wrong admin).
function hint(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes('unauthorized_client') || r.includes('not authorized') || r.includes('unauthorized'))
    return 'The service account isn’t authorised for the Directory scopes in domain-wide delegation. In admin.google.com → Security → Access and data control → API controls → Domain-wide delegation, add the service account’s Client ID with admin.directory.user(.readonly) and admin.directory.group(.readonly).';
  if (r.includes('invalid_grant'))
    return 'Google rejected the sign-in (invalid_grant). Check GOOGLE_WORKSPACE_ADMIN_EMAIL is a real super-admin in this Workspace and that the service-account key is current.';
  if (r.includes('access_denied') || r.includes('forbidden') || r.includes('403'))
    return 'Access denied (403). The impersonated admin may lack directory rights, or the Admin SDK API isn’t enabled on the Cloud project.';
  if (r.includes('not found') || r.includes('404'))
    return 'Not found (404) — check GOOGLE_WORKSPACE_CUSTOMER_ID, or leave it unset to use my_customer.';
  return reason;
}

// Token mint that captures the real failure reason. directoryToken stays a thin
// wrapper so the existing write paths (dirFetch) are unchanged.
async function directoryTokenDetailed(scopes: string): Promise<{ token?: string; error?: string }> {
  const cached = tokenCache.get(scopes);
  if (cached && cached.expiresAt > Date.now() + 60_000) return { token: cached.token };

  const [saKeyRaw, adminEmail] = await Promise.all([
    getSecret('GOOGLE_WORKSPACE_SA_KEY'),
    getSecret('GOOGLE_WORKSPACE_ADMIN_EMAIL'),
  ]);
  if (!saKeyRaw || !adminEmail) return { error: 'Service-account key or admin email not set.' };

  let saKey: { client_email: string; private_key: string };
  try {
    saKey = JSON.parse(saKeyRaw);
  } catch {
    return { error: 'The service-account key isn’t valid JSON — paste the entire downloaded file.' };
  }
  if (!saKey.client_email || !saKey.private_key) return { error: 'The service-account key is missing client_email or private_key.' };

  let privateKey: CryptoKey;
  try {
    privateKey = await importPKCS8(saKey.private_key, 'RS256');
  } catch {
    return { error: 'Could not read the private key in the service-account JSON.' };
  }

  let assertion: string;
  try {
    assertion = await new SignJWT({ scope: scopes })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(saKey.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setSubject(adminEmail)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not sign the service-account token.' };
  }

  let res: Response;
  try {
    res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Network error reaching the Google token endpoint.' };
  }

  const j = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
  if (!res.ok || !j?.access_token) {
    return { error: hint(String(j?.error_description || j?.error || `HTTP ${res.status}`)) };
  }

  const ttl = j.expires_in ? Number(j.expires_in) * 1000 : 3_600_000;
  tokenCache.set(scopes, { token: String(j.access_token), expiresAt: Date.now() + ttl });
  return { token: j.access_token };
}

async function directoryToken(scopes: string): Promise<string | null> {
  return (await directoryTokenDetailed(scopes)).token ?? null;
}

async function customer(): Promise<string> {
  return (await getSecret('GOOGLE_WORKSPACE_CUSTOMER_ID')) || 'my_customer';
}

async function dirFetch(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  write = false,
): Promise<Response | null> {
  const token = await directoryToken(write ? WRITE_SCOPES : READ_SCOPES);
  if (!token) return null;
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(`https://admin.googleapis.com/admin/directory/v1${path}`, opts);
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type WorkspaceUser = {
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  suspended: boolean;
  isAdmin: boolean;
  lastLoginTime?: string;
  creationTime?: string;
  aliases?: string[];
};

export type WorkspaceGroup = {
  email: string;
  name: string;
  description?: string;
  directMembersCount?: number;
};

export type NewUser = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

// ── User functions ─────────────────────────────────────────────────────────────

function parseUser(u: Record<string, unknown>): WorkspaceUser {
  const n = (u.name as Record<string, string> | undefined) ?? {};
  return {
    email: String(u.primaryEmail ?? ''),
    name: n.fullName ? String(n.fullName) : `${n.givenName ?? ''} ${n.familyName ?? ''}`.trim(),
    givenName: n.givenName ? String(n.givenName) : undefined,
    familyName: n.familyName ? String(n.familyName) : undefined,
    suspended: Boolean(u.suspended),
    isAdmin: Boolean(u.isAdmin),
    lastLoginTime: u.lastLoginTime ? String(u.lastLoginTime) : undefined,
    creationTime: u.creationTime ? String(u.creationTime) : undefined,
    aliases: Array.isArray(u.aliases) ? u.aliases.map(String) : undefined,
  };
}

export async function listWorkspaceUsers(): Promise<WorkspaceUser[]> {
  const c = await customer();
  const res = await dirFetch('GET', `/users?customer=${c}&maxResults=500&orderBy=email&projection=full`);
  if (!res?.ok) return [];
  const j = await res.json().catch(() => null);
  const users: Record<string, unknown>[] = j?.users ?? [];
  return users.map(parseUser);
}

// Like listWorkspaceUsers, but reports *why* it failed so the UI can show the real
// reason (e.g. "delegation not authorised") instead of a misleading empty list.
export async function listWorkspaceUsersResult(): Promise<{ ok: boolean; configured: boolean; users: WorkspaceUser[]; error?: string }> {
  if (!(await workspaceConfigured())) return { ok: false, configured: false, users: [] };
  const tok = await directoryTokenDetailed(READ_SCOPES);
  if (!tok.token) return { ok: false, configured: true, users: [], error: tok.error };
  const c = await customer();
  let res: Response;
  try {
    res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?customer=${c}&maxResults=500&orderBy=email&projection=full`, {
      headers: { Authorization: `Bearer ${tok.token}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, configured: true, users: [], error: e instanceof Error ? e.message : 'Network error contacting Google.' };
  }
  const j = (await res.json().catch(() => null)) as { users?: Record<string, unknown>[]; error?: { message?: string } } | null;
  if (!res.ok) return { ok: false, configured: true, users: [], error: hint(String(j?.error?.message || `HTTP ${res.status}`)) };
  return { ok: true, configured: true, users: (j?.users ?? []).map(parseUser) };
}

export async function getWorkspaceUser(email: string): Promise<WorkspaceUser | null> {
  const res = await dirFetch('GET', `/users/${encodeURIComponent(email)}?projection=full`);
  if (!res?.ok) return null;
  const u = await res.json().catch(() => null);
  return u ? parseUser(u as Record<string, unknown>) : null;
}

export async function createWorkspaceUser(input: NewUser): Promise<WorkspaceUser | null> {
  const res = await dirFetch(
    'POST',
    '/users',
    {
      primaryEmail: input.email,
      name: { givenName: input.firstName, familyName: input.lastName },
      password: input.password,
      changePasswordAtNextLogin: true,
    },
    true,
  );
  if (!res?.ok) return null;
  const u = await res.json().catch(() => null);
  return u ? parseUser(u as Record<string, unknown>) : null;
}

export async function suspendWorkspaceUser(email: string): Promise<boolean> {
  const res = await dirFetch('PATCH', `/users/${encodeURIComponent(email)}`, { suspended: true }, true);
  return res?.ok ?? false;
}

export async function restoreWorkspaceUser(email: string): Promise<boolean> {
  const res = await dirFetch('PATCH', `/users/${encodeURIComponent(email)}`, { suspended: false }, true);
  return res?.ok ?? false;
}

export async function addUserAlias(email: string, alias: string): Promise<boolean> {
  const res = await dirFetch('POST', `/users/${encodeURIComponent(email)}/aliases`, { alias }, true);
  return res?.ok ?? false;
}

export async function removeUserAlias(email: string, alias: string): Promise<boolean> {
  const res = await dirFetch('DELETE', `/users/${encodeURIComponent(email)}/aliases/${encodeURIComponent(alias)}`, undefined, true);
  return res?.ok ?? false;
}

// ── Group functions ────────────────────────────────────────────────────────────

export async function listGroups(): Promise<WorkspaceGroup[]> {
  const c = await customer();
  const res = await dirFetch('GET', `/groups?customer=${c}&maxResults=200&orderBy=email`);
  if (!res?.ok) return [];
  const j = await res.json().catch(() => null);
  const groups: Record<string, unknown>[] = j?.groups ?? [];
  return groups.map((g) => ({
    email: String(g.email ?? ''),
    name: String(g.name ?? ''),
    description: g.description ? String(g.description) : undefined,
    directMembersCount: g.directMembersCount != null ? Number(g.directMembersCount) : undefined,
  }));
}

// Diagnostic counterpart to listGroups (see listWorkspaceUsersResult).
export async function listGroupsResult(): Promise<{ ok: boolean; configured: boolean; groups: WorkspaceGroup[]; error?: string }> {
  if (!(await workspaceConfigured())) return { ok: false, configured: false, groups: [] };
  const tok = await directoryTokenDetailed(READ_SCOPES);
  if (!tok.token) return { ok: false, configured: true, groups: [], error: tok.error };
  const c = await customer();
  let res: Response;
  try {
    res = await fetch(`https://admin.googleapis.com/admin/directory/v1/groups?customer=${c}&maxResults=200&orderBy=email`, {
      headers: { Authorization: `Bearer ${tok.token}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, configured: true, groups: [], error: e instanceof Error ? e.message : 'Network error contacting Google.' };
  }
  const j = (await res.json().catch(() => null)) as { groups?: Record<string, unknown>[]; error?: { message?: string } } | null;
  if (!res.ok) return { ok: false, configured: true, groups: [], error: hint(String(j?.error?.message || `HTTP ${res.status}`)) };
  const groups = (j?.groups ?? []).map((g) => ({
    email: String(g.email ?? ''),
    name: String(g.name ?? ''),
    description: g.description ? String(g.description) : undefined,
    directMembersCount: g.directMembersCount != null ? Number(g.directMembersCount) : undefined,
  }));
  return { ok: true, configured: true, groups };
}

export async function createGroup(email: string, name: string, description?: string): Promise<WorkspaceGroup | null> {
  const res = await dirFetch('POST', '/groups', { email, name, ...(description ? { description } : {}) }, true);
  if (!res?.ok) return null;
  const g = await res.json().catch(() => null);
  return g ? { email: String(g.email ?? ''), name: String(g.name ?? '') } : null;
}

export async function addGroupMember(groupEmail: string, memberEmail: string): Promise<boolean> {
  const res = await dirFetch('POST', `/groups/${encodeURIComponent(groupEmail)}/members`, { email: memberEmail, role: 'MEMBER' }, true);
  return res?.ok ?? false;
}

export async function removeGroupMember(groupEmail: string, memberEmail: string): Promise<boolean> {
  const res = await dirFetch('DELETE', `/groups/${encodeURIComponent(groupEmail)}/members/${encodeURIComponent(memberEmail)}`, undefined, true);
  return res?.ok ?? false;
}
