import 'server-only';
import { db } from '@/lib/db';
import { encryptJson, decryptJson } from '@/lib/crypto';
import { site } from '@/lib/site';

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

// Read busy-time off the clinician's calendar AND write the clinic's confirmed
// bookings onto it (two-way sync). `calendar.events` covers both; switching up
// from the old read-only scope means each clinician re-consents once.
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

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

/** Sync every connected clinician (used by cron + manual trigger). PRJ-918.8:
 *  per-staff failures are counted and surfaced (ok flips false) instead of
 *  being discarded — a clinician whose token expired silently stopped syncing. */
export async function syncAllCalendars(): Promise<{ ok: boolean; staff: number; imported: number; failed: number }> {
  if (!googleConfigured()) return { ok: false, staff: 0, imported: 0, failed: 0 };
  const connected = await db.adminUser.findMany({ where: { googleRefreshToken: { not: null }, active: true }, select: { id: true } });
  let imported = 0;
  let failed = 0;
  for (const s of connected) {
    const r = await syncStaffCalendar(s.id);
    imported += r.imported;
    if (!r.ok) { failed++; console.error(`[google-calendar] sync failed for staff ${s.id}: ${r.error}`); }
  }
  return { ok: failed === 0, staff: connected.length, imported, failed };
}

// ── Outbound: write the clinic's bookings onto the clinician's calendar ──────
// Mirrors the assigned clinician's confirmed appointments onto their own Google
// Calendar, so their work diary is complete alongside their personal events.
// Idempotent via Booking.googleEventId; best-effort — never blocks the booking
// lifecycle. No-op when Google is parked, the booking has no connected
// clinician, or the event can't be written.

/** Create or update the calendar event for a booking on its clinician's calendar. */
export async function pushBookingToClinician(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  if (!googleEnabled()) return { ok: false, error: 'parked' };
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      practitioner: { select: { googleRefreshToken: true, googleCalendarId: true } },
    },
  });
  if (!b || b.status === 'CANCELLED') return { ok: false, error: 'not pushable' };
  const staff = b.practitioner;
  if (!staff?.googleRefreshToken) return { ok: false, error: 'clinician not connected' };

  const token = await accessToken(decryptRefresh(staff.googleRefreshToken));
  if (!token) return { ok: false, error: 'token refresh failed' };

  // PRJ-939.6: the clinician's Google Calendar is often a personal account —
  // outside the CRM's access controls, mirrored to lock screens, notification
  // previews and any calendars they share. A treatment name can itself reveal
  // a health condition, so the event carries no clinical or contact substance:
  // a generic title and a link back to the CRM booking, which enforces its own
  // login and role checks. (The Hostinger CalDAV feed is the clinic's own
  // business calendar and keeps its operational detail — see hostinger-calendar.)
  const event = {
    summary: 'KClinics appointment',
    description: `Details in the CRM (login required): ${site.url}/admin/bookings/${b.id}`,
    start: { dateTime: b.startAt.toISOString() },
    end: { dateTime: b.endAt.toISOString() },
    // Tag the event so it's identifiable as clinic-managed.
    extendedProperties: { private: { kcBookingId: b.id } },
  };

  const calId = encodeURIComponent(staff.googleCalendarId || 'primary');
  const base = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;
  const existing = b.googleEventId;
  const res = await fetch(existing ? `${base}/${encodeURIComponent(existing)}` : base, {
    method: existing ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // The stored event was deleted on Google's side — drop the id and recreate.
    if (existing && res.status === 404) {
      await db.booking.update({ where: { id: b.id }, data: { googleEventId: null } });
      return pushBookingToClinician(bookingId);
    }
    return { ok: false, error: `Calendar ${res.status}` };
  }
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  if (data?.id && data.id !== existing) await db.booking.update({ where: { id: b.id }, data: { googleEventId: data.id } });
  return { ok: true };
}

/** Remove a booking's event from its clinician's calendar (on cancellation). */
export async function removeBookingFromClinician(bookingId: string): Promise<{ ok: boolean }> {
  if (!googleEnabled()) return { ok: false };
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: { googleEventId: true, practitioner: { select: { googleRefreshToken: true, googleCalendarId: true } } },
  });
  if (!b?.googleEventId || !b.practitioner?.googleRefreshToken) return { ok: false };
  const token = await accessToken(decryptRefresh(b.practitioner.googleRefreshToken));
  if (!token) return { ok: false };
  const calId = encodeURIComponent(b.practitioner.googleCalendarId || 'primary');
  // BLD-914: only clear googleEventId when the event is actually gone from
  // Google's side (deleted now, or already deleted/expired: 404/410). Clearing
  // it on a failed delete left a cancelled appointment live on the clinician's
  // calendar with no record that the sync failed.
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(b.googleEventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error('[google-calendar] event delete failed:', res.status, bookingId);
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureException(new Error(`Google Calendar event delete failed (${res.status})`), { tags: { area: 'google-calendar', stage: 'remove-booking' } });
      return { ok: false };
    }
  } catch (e) {
    console.error('[google-calendar] event delete failed:', (e as Error)?.message, bookingId);
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(e, { tags: { area: 'google-calendar', stage: 'remove-booking' } });
    return { ok: false };
  }
  await db.booking.update({ where: { id: bookingId }, data: { googleEventId: null } });
  return { ok: true };
}

/** One-time sweep (PRJ-939.6): re-push every future clinic event so calendars
 *  that already carry clinical titles and contact details get the redacted
 *  content. Keyed in Settings so it runs once; new pushes are redacted at
 *  source. Not run while Google is parked — the key is only stamped after a
 *  real pass, so re-enabling the integration later still triggers the sweep. */
export async function redactFutureClinicianEvents(): Promise<{ ok: boolean; updated: number }> {
  const KEY = 'gcal_redact_backfill_v1';
  if (!googleEnabled()) return { ok: false, updated: 0 };
  const done = await db.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  if (done) return { ok: true, updated: 0 };
  const rows = await db.booking.findMany({
    where: { googleEventId: { not: null }, startAt: { gte: new Date() }, status: { not: 'CANCELLED' } },
    select: { id: true },
  });
  let updated = 0;
  for (const r of rows) {
    const res = await pushBookingToClinician(r.id).catch(() => ({ ok: false }));
    if (res.ok) updated++;
  }
  await db.setting.upsert({ where: { key: KEY }, update: { value: new Date().toISOString() }, create: { key: KEY, value: new Date().toISOString() } });
  console.log(`[google-calendar] redaction backfill: ${updated}/${rows.length} future events re-pushed (PRJ-939.6)`);
  return { ok: true, updated };
}
