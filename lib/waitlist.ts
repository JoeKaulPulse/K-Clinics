import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

// BLD-133 — cancellation waitlist. Phase 1: clients join a waitlist for a
// treatment within a date window; when a matching slot frees (a cancellation),
// the first ACTIVE entry is emailed. Phase 2 adds the one-click claim→book link
// (claimToken + offeredStart are written now so phase 2 is purely additive).

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
const dayOnly = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

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
 * throws into the caller (a cancellation must always succeed).
 */
export async function notifyOnFreedSlot(treatmentSlug: string, slotStart: Date): Promise<void> {
  try {
    const day = dayOnly(slotStart);
    const entry = await db.waitlistEntry.findFirst({
      where: { treatmentSlug, status: 'ACTIVE', fromDate: { lte: day }, toDate: { gte: day } },
      orderBy: { createdAt: 'asc' },
      include: { client: { select: { firstName: true, email: true, unsubToken: true } } },
    });
    if (!entry?.client?.email) return;

    const { randomUUID } = await import('node:crypto');
    const claimToken = randomUUID();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6h to act
    await db.waitlistEntry.update({ where: { id: entry.id }, data: { status: 'NOTIFIED', notifiedAt: new Date(), expiresAt, claimToken, offeredStart: slotStart } });

    const { sendEmail, emailShell } = await import('@/lib/email');
    const when = slotStart.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const body = `
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#a98a6d;margin:0 0 8px;">Waitlist</p>
      <h1 style="margin:0 0 12px;font-size:25px;">A ${escapeHtml(entry.treatmentTitle)} slot just opened</h1>
      <p style="margin:0 0 14px;">Hi ${escapeHtml(entry.client.firstName || 'there')}, a space has come up for <strong>${escapeHtml(entry.treatmentTitle)}</strong> on <strong>${when}</strong>. Spaces go quickly — book it now while it's free.</p>
      <p style="margin:6px 0 18px;"><a href="${SITE_URL}/book?treatment=${encodeURIComponent(treatmentSlug)}" style="display:inline-block;background:#a98a6d;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-size:14px;">Book this slot</a></p>
      <p style="font-size:13px;color:#91766e;">If it's already gone, you'll stay on the waitlist for the next opening.</p>`;
    await sendEmail({ to: entry.client.email, subject: `A ${entry.treatmentTitle} slot just opened`, html: emailShell({ body, preheader: `A space opened on ${when}.`, unsubUrl: entry.client.unsubToken ? `${SITE_URL}/unsubscribe/${entry.client.unsubToken}` : undefined }) });
    await db.emailEvent.create({ data: { clientId: entry.clientId, kind: 'MANUAL', to: entry.client.email, subject: 'Waitlist slot opened', status: 'SENT' } }).catch(() => {});
  } catch (e) {
    console.error('[waitlist] notify failed (non-fatal):', (e as Error)?.message);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
