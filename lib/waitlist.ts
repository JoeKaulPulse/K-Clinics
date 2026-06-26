import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

// BLD-133 — cancellation waitlist.
//  • Phase 1: clients join a waitlist for a treatment within a date window;
//    when a matching slot frees (a cancellation), the first ACTIVE entry is
//    emailed a one-click claim link.
//  • Phase 2: the claim link (claimToken) drops the client straight into the
//    booking flow on the offered day; completing the booking marks the entry
//    CLAIMED. If the 6-hour window lapses, rotateExpiredWaitlist() expires the
//    offer and re-offers the (still-free) slot to the next person in line.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
const CLAIM_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h to act on an offered slot
// BLD-336: a directly-offered freed slot uses a shorter lead than the public
// 2-hour online-booking window — otherwise a same-day cancellation (the most
// valuable kind for a waitlister) is never re-offered. 45 min keeps the claim
// actionable (the waitlister still has to travel) while covering same-day frees.
const REOFFER_LEAD_MINUTES = 45;
const dayOnly = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Public URL of the one-click claim landing page for a token. */
export function claimUrl(token: string): string {
  return `${SITE_URL}/waitlist/claim/${encodeURIComponent(token)}`;
}

/**
 * Lead-window override for a booking being created from a waitlist claim link
 * (BLD-336). Returns the reduced re-offer lead only when `token` is a live
 * (NOTIFIED, unexpired) offer for exactly this slot; otherwise undefined, so the
 * public 2-hour lead still applies to everything else. Lets a genuinely-freed
 * same-day slot actually be booked by the waitlister we offered it to.
 */
export async function claimLeadOpts(token: string | undefined | null, startISO: string): Promise<{ leadMinutes: number } | undefined> {
  if (!token) return undefined;
  try {
    const entry = await db.waitlistEntry.findFirst({
      where: { claimToken: token, status: 'NOTIFIED' },
      select: { offeredStart: true, expiresAt: true },
    });
    if (!entry?.offeredStart) return undefined;
    if (entry.expiresAt && entry.expiresAt.getTime() < Date.now()) return undefined;
    if (entry.offeredStart.toISOString() !== startISO) return undefined;
    return { leadMinutes: REOFFER_LEAD_MINUTES };
  } catch {
    return undefined;
  }
}

/** Add (or reuse) an ACTIVE waitlist entry for a client + treatment + window. */
export async function joinWaitlist(input: { clientId: string; treatmentSlug: string; treatmentTitle: string; fromDate: Date; toDate: Date }): Promise<{ ok: boolean; created: boolean }> {
  const from = dayOnly(input.fromDate);
  const to = dayOnly(input.toDate);
  // Dedupe: an existing ACTIVE entry for the same treatment whose window overlaps
  // is left as-is rather than stacking duplicates.
  const existing = await db.waitlistEntry.findFirst({
    where: { clientId: input.clientId, treatmentSlug: input.treatmentSlug, status: 'ACTIVE', fromDate: { lte: to }, toDate: { gte: from } },
    select: { id: true },
  }).catch(() => null);
  if (existing) return { ok: true, created: false };
  await db.waitlistEntry.create({ data: { clientId: input.clientId, treatmentSlug: input.treatmentSlug, treatmentTitle: input.treatmentTitle, fromDate: from, toDate: to } });
  return { ok: true, created: true };
}

/**
 * A slot for `treatmentSlug` starting at `slotStart` has freed up — notify the
 * first ACTIVE waitlister whose window covers that date. Best-effort; never
 * throws into the caller (a cancellation must always succeed). Returns whether
 * an offer was sent (used by the rotation to know if the slot found a taker).
 */
export async function notifyOnFreedSlot(treatmentSlug: string, slotStart: Date): Promise<boolean> {
  try {
    // Only offer a slot a waitlister could actually book: still genuinely free in
    // the live availability engine (in-hours, lead time, no clash). A slot that's
    // since been re-taken — or is now too soon — is skipped silently.
    const { bookingFor } = await import('@/lib/treatments');
    const { isSlotFree } = await import('@/lib/availability');
    const { durationMin } = bookingFor(treatmentSlug);
    if (!(await isSlotFree(slotStart.toISOString(), durationMin, treatmentSlug, null, { leadMinutes: REOFFER_LEAD_MINUTES }).catch(() => false))) return false;

    const day = dayOnly(slotStart);
    const entry = await db.waitlistEntry.findFirst({
      where: { treatmentSlug, status: 'ACTIVE', fromDate: { lte: day }, toDate: { gte: day } },
      orderBy: { createdAt: 'asc' },
      include: { client: { select: { firstName: true, email: true, unsubToken: true } } },
    });
    if (!entry?.client?.email) return false;

    const { randomUUID } = await import('node:crypto');
    const claimToken = randomUUID();
    const expiresAt = new Date(Date.now() + CLAIM_WINDOW_MS);
    await db.waitlistEntry.update({ where: { id: entry.id }, data: { status: 'NOTIFIED', notifiedAt: new Date(), expiresAt, claimToken, offeredStart: slotStart } });

    const { sendEmail, emailShell } = await import('@/lib/email');
    const when = slotStart.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const link = claimUrl(claimToken);
    const body = `
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#a98a6d;margin:0 0 8px;">Waitlist</p>
      <h1 style="margin:0 0 12px;font-size:25px;">A ${escapeHtml(entry.treatmentTitle)} slot just opened</h1>
      <p style="margin:0 0 14px;">Hi ${escapeHtml(entry.client.firstName || 'there')}, a space has come up for <strong>${escapeHtml(entry.treatmentTitle)}</strong> on <strong>${when}</strong>. It's yours to claim for the next 6 hours — after that we offer it to the next person on the list.</p>
      <p style="margin:6px 0 18px;"><a href="${link}" style="display:inline-block;background:#a98a6d;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;">Claim this slot</a></p>
      <p style="font-size:13px;color:#91766e;">If it's already gone, you'll stay on the waitlist for the next opening. This link only works for you.</p>`;
    await sendEmail({ to: entry.client.email, subject: `A ${entry.treatmentTitle} slot just opened`, html: emailShell({ body, preheader: `A space opened on ${when} — claim it within 6 hours.`, unsubUrl: entry.client.unsubToken ? `${SITE_URL}/unsubscribe/${entry.client.unsubToken}` : undefined }) });
    await db.emailEvent.create({ data: { clientId: entry.clientId, kind: 'MANUAL', to: entry.client.email, subject: 'Waitlist slot opened', status: 'SENT' } }).catch(() => {});
    // A freed slot was matched to a waitlister — let the diary know a booking may land.
    try {
      const { notifyStaffByPermission } = await import('@/lib/notifications');
      await notifyStaffByPermission('bookings.view', { kind: 'status', category: 'bookings', priority: 'normal', title: `Waitlist slot offered: ${entry.treatmentTitle}`, body: `${entry.client.firstName || 'A client'} · ${when}`, href: '/admin/waitlist' });
    } catch { /* non-fatal */ }
    return true;
  } catch (e) {
    console.error('[waitlist] notify failed (non-fatal):', (e as Error)?.message);
    return false;
  }
}

/** A NOTIFIED entry as resolved by a claim token, with the live state needed to
 *  decide what the claim page can offer. */
export type ClaimLookup =
  | { state: 'ok'; entry: { id: string; treatmentSlug: string; treatmentTitle: string; offeredStart: Date; clientId: string } }
  | { state: 'expired' | 'gone' | 'claimed' | 'taken' | 'invalid' };

/**
 * Resolve a claim token for the landing page. Returns the offer when it's still
 * live and the slot is genuinely bookable; otherwise a reason the page explains.
 * Expiring a lapsed offer here (and rotating it onward) keeps the flow correct
 * even between cron sweeps.
 */
export async function lookupClaim(token: string): Promise<ClaimLookup> {
  if (!token) return { state: 'invalid' };
  const entry = await db.waitlistEntry.findFirst({
    where: { claimToken: token },
    select: { id: true, status: true, offeredStart: true, expiresAt: true, treatmentSlug: true, treatmentTitle: true, clientId: true },
  }).catch(() => null);
  if (!entry || !entry.offeredStart) return { state: 'invalid' };
  if (entry.status === 'CLAIMED') return { state: 'claimed' };
  if (entry.status !== 'NOTIFIED') return { state: 'gone' };
  if (entry.expiresAt && entry.expiresAt.getTime() < Date.now()) {
    // Lapsed: expire it and hand the slot to the next person right away.
    await expireAndRotate(entry.id, entry.treatmentSlug, entry.offeredStart).catch(() => {});
    return { state: 'expired' };
  }
  // Confirm the slot is still actually bookable (it may have been taken since).
  // Match the reduced re-offer lead used when the offer was sent, so a same-day
  // slot we deliberately offered isn't then rejected here as "taken" (BLD-336).
  const { bookingFor } = await import('@/lib/treatments');
  const { isSlotFree } = await import('@/lib/availability');
  const { durationMin } = bookingFor(entry.treatmentSlug);
  const free = await isSlotFree(entry.offeredStart.toISOString(), durationMin, entry.treatmentSlug, null, { leadMinutes: REOFFER_LEAD_MINUTES }).catch(() => false);
  if (!free) return { state: 'taken' };
  return { state: 'ok', entry: { id: entry.id, treatmentSlug: entry.treatmentSlug, treatmentTitle: entry.treatmentTitle, offeredStart: entry.offeredStart, clientId: entry.clientId } };
}

/**
 * Mark the waitlist entry behind a claim token as CLAIMED once its booking is
 * created. Called from the booking creation paths (best-effort; a failure here
 * must never break a successful booking). Only flips a live (NOTIFIED/ACTIVE)
 * entry, so replays and stale tokens are no-ops.
 */
export async function claimWaitlist(token: string | undefined | null, opts: { clientId?: string } = {}): Promise<boolean> {
  if (!token) return false;
  try {
    const r = await db.waitlistEntry.updateMany({
      where: { claimToken: token, status: { in: ['NOTIFIED', 'ACTIVE'] }, ...(opts.clientId ? { clientId: opts.clientId } : {}) },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    });
    return r.count > 0;
  } catch (e) {
    console.error('[waitlist] claim failed (non-fatal):', (e as Error)?.message);
    return false;
  }
}

/** Expire one NOTIFIED entry and re-offer its (still-free, still-future) slot to
 *  the next ACTIVE waitlister. Shared by the cron sweep and the claim page. */
async function expireAndRotate(entryId: string, treatmentSlug: string, offeredStart: Date): Promise<void> {
  await db.waitlistEntry.updateMany({ where: { id: entryId, status: 'NOTIFIED' }, data: { status: 'EXPIRED' } });
  // Re-offer only a future slot; notifyOnFreedSlot re-checks live availability and
  // picks the next ACTIVE waitlister (this one is now EXPIRED, so it's skipped).
  if (offeredStart.getTime() > Date.now()) await notifyOnFreedSlot(treatmentSlug, offeredStart).catch(() => {});
}

/**
 * Sweep NOTIFIED offers whose 6-hour window has lapsed: expire them and pass the
 * freed slot to the next person in line. Idempotent and bounded; safe to run on
 * a frequent cron. Returns counts for observability.
 */
export async function rotateExpiredWaitlist(): Promise<{ expired: number; reoffered: number }> {
  const due = await db.waitlistEntry.findMany({
    where: { status: 'NOTIFIED', expiresAt: { lt: new Date() } },
    select: { id: true, treatmentSlug: true, offeredStart: true },
    take: 100,
  }).catch(() => []);
  let reoffered = 0;
  for (const e of due) {
    await db.waitlistEntry.updateMany({ where: { id: e.id, status: 'NOTIFIED' }, data: { status: 'EXPIRED' } }).catch(() => {});
    if (e.offeredStart && e.offeredStart.getTime() > Date.now()) {
      const sent = await notifyOnFreedSlot(e.treatmentSlug, e.offeredStart).catch(() => false);
      if (sent) reoffered += 1;
    }
  }
  return { expired: due.length, reoffered };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
