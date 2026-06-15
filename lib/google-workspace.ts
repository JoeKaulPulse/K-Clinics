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

async function directoryToken(scopes: string): Promise<string | null> {
  const cached = tokenCache.get(scopes);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const [saKeyRaw, adminEmail] = await Promise.all([
    getSecret('GOOGLE_WORKSPACE_SA_KEY'),
    getSecret('GOOGLE_WORKSPACE_ADMIN_EMAIL'),
  ]);
  if (!saKeyRaw || !adminEmail) return null;

  let saKey: { client_email: string; private_key: string };
  try {
    saKey = JSON.parse(saKeyRaw);
  } catch {
    return null;
  }
  if (!saKey.client_email || !saKey.private_key) return null;

  let privateKey: CryptoKey;
  try {
    privateKey = await importPKCS8(saKey.private_key, 'RS256');
  } catch {
    return null;
  }

  const assertion = await new SignJWT({ scope: scopes })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(saKey.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setSubject(adminEmail)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  if (!j?.access_token) return null;

  const ttl = j.expires_in ? Number(j.expires_in) * 1000 : 3_600_000;
  tokenCache.set(scopes, { token: String(j.access_token), expiresAt: Date.now() + ttl });
  return j.access_token as string;
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
