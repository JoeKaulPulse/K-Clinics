import 'server-only';
import { db } from '@/lib/db';
import { encryptJson, decryptJson } from '@/lib/crypto';

// The staff Google refresh token is a long-lived credential, so it is encrypted
// at rest via the keyring (mirrors AdminUser.totpSecret) rather than stored
// plaintext. Reads tolerate any pre-existing plaintext value during migration.
const encryptRefresh = (token: string): string => encryptJson(token);
const decryptRefresh = (stored: string): string => {
  try { return decryptJson<string>(stored); } catch { return stored; }
};

// Google Calendar integration (busy-time import). Activates when Google OAuth
// credentials are configured; otherwise every function is a safe no-op.
//
//   GOOGLE_CLIENT_ID      — OAuth client id
//   GOOGLE_CLIENT_SECRET  — OAuth client secret
//   GOOGLE_REDIRECT_URI   — e.g. https://yourdomain/api/admin/gcal/callback
//
// Each clinician connects their own calendar (stores a refresh token on the
// AdminUser). We import their busy blocks into StaffTimeOff as GCAL_BUSY, so the
// availability engine treats external commitments as unavailable automatically.

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

/**
 * Whether the Google Workspace integration is *active*. The clinic is currently
 * on Hostinger, so Google is PARKED by default — the code is kept intact but
 * inert until GOOGLE_INTEGRATION_ENABLED=true (e.g. on a future Workspace move).
 */
export function googleEnabled(): boolean {
  return process.env.GOOGLE_INTEGRATION_ENABLED === 'true' && googleConfigured();
}

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

/** URL to start the OAuth consent flow. `state` is the CSRF nonce minted (and
 *  cookie-bound) by the connect route — it carries the target staffId after the
 *  nonce so the callback can attach the token only after validating the state. */
export function googleAuthUrl(state: string): string | null {
  if (!googleConfigured()) return null;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Exchange an auth code for tokens and store the refresh token on the staff. */
export async function exchangeCodeForStaff(code: string, staffId: string): Promise<boolean> {
  if (!googleConfigured()) return false;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { refresh_token?: string };
  if (!data.refresh_token) return false; // already consented previously without prompt
  await db.adminUser.update({ where: { id: staffId }, data: { googleRefreshToken: encryptRefresh(data.refresh_token), googleCalendarId: 'primary' } });
  return true;
}

async function accessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** Pull busy intervals for a connected staff member over the next `days` days
 *  and mirror them into StaffTimeOff as GCAL_BUSY (idempotent via gcalEventId). */
export async function syncStaffCalendar(staffId: string, days = 60): Promise<{ ok: boolean; imported: number; error?: string }> {
  if (!googleConfigured()) return { ok: false, imported: 0, error: 'Google not configured' };
  const staff = await db.adminUser.findUnique({ where: { id: staffId }, select: { googleRefreshToken: true, googleCalendarId: true } });
  if (!staff?.googleRefreshToken) return { ok: false, imported: 0, error: 'Not connected' };

  const token = await accessToken(decryptRefresh(staff.googleRefreshToken));
  if (!token) return { ok: false, imported: 0, error: 'Token refresh failed' };

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 864e5).toISOString();
  const calId = encodeURIComponent(staff.googleCalendarId || 'primary');
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return { ok: false, imported: 0, error: `Calendar fetch ${res.status}` };
  const data = (await res.json()) as { items?: { id: string; status?: string; transparency?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; summary?: string }[] };

  let imported = 0;
  for (const ev of data.items ?? []) {
    if (ev.status === 'cancelled' || ev.transparency === 'transparent') continue; // free/declined
    const startAt = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : null;
    const endAt = ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date) : null;
    if (!startAt || !endAt) continue;
    const gcalEventId = `${staffId}:${ev.id}`;
    await db.staffTimeOff.upsert({
      where: { gcalEventId },
      update: { startAt, endAt, reason: ev.summary || 'Busy (Google Calendar)' },
      create: { staffId, kind: 'GCAL_BUSY', startAt, endAt, reason: ev.summary || 'Busy (Google Calendar)', gcalEventId },
    });
    imported++;
  }
  // Remove stale GCAL_BUSY blocks no longer present (in the synced window, future).
  // Kept simple: prune past GCAL_BUSY entries.
  await db.staffTimeOff.deleteMany({ where: { staffId, kind: 'GCAL_BUSY', endAt: { lt: new Date() } } });

  return { ok: true, imported };
}

/** Sync every connected clinician (used by cron + manual trigger). */
export async function syncAllCalendars(): Promise<{ ok: boolean; staff: number; imported: number }> {
  if (!googleConfigured()) return { ok: false, staff: 0, imported: 0 };
  const connected = await db.adminUser.findMany({ where: { googleRefreshToken: { not: null }, active: true }, select: { id: true } });
  let imported = 0;
  for (const s of connected) {
    const r = await syncStaffCalendar(s.id);
    imported += r.imported;
  }
  return { ok: true, staff: connected.length, imported };
}
