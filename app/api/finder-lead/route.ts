import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-1127 (owner decision 5 Aug: optional email step) — the Treatment Finder's
// "Email me my results" action. Entering an email creates the CRM lead and
// sends the results; skipping the step keeps the quiz fully anonymous. The
// consent line shown at the input covers exactly this send — it is NOT a
// marketing opt-in and records none.
const schema = z.object({
  email: z.string().email(),
  firstName: z.string().max(80).optional().or(z.literal('')),
  slugs: z.array(z.string().max(80)).min(1).max(3),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
  eventId: z.string().max(100).optional(), // shared with the browser Lead pixel for CAPI/GA4 dedup
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'finder-lead', 10, 600))) {
    return NextResponse.json({ ok: false, error: 'Too many requests — please try again shortly.' }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Enter a valid email.' }, { status: 422 });
  const d = parsed.data;

  const { getTreatment, formatPrice } = await import('@/lib/treatments');
  const treatments = d.slugs.map(getTreatment).filter((t): t is NonNullable<ReturnType<typeof getTreatment>> => Boolean(t));
  if (treatments.length === 0) return NextResponse.json({ ok: false, error: 'No results to send.' }, { status: 422 });

  const { db } = await import('@/lib/db');
  const email = d.email.toLowerCase();
  const firstName = (d.firstName || '').trim();
  // No-clobber upsert: an existing client's details are never overwritten by
  // an unauthenticated form (PRJ-1034.1 convention).
  const client = await db.client.upsert({
    where: { email },
    update: {},
    create: { email, firstName: firstName || 'Guest', source: 'treatment-finder' },
  });
  await db.interaction.create({
    data: { clientId: client.id, type: 'NOTE', summary: `Treatment Finder results emailed: ${treatments.map((t) => t.title).join(', ')}`, author: 'system' },
  }).catch(() => {});

  const { site } = await import('@/lib/site');
  const base = process.env.NEXT_PUBLIC_SITE_URL || site.url;
  const { pricingByTreatment } = await import('@/lib/services');
  const pricing = await pricingByTreatment().catch(() => new Map());
  const rows = treatments.map((t) => {
    const from = pricing.get(t.slug)?.fromPence ?? null;
    return `<li style="margin-bottom:8px"><a href="${base}/${t.slug}"><strong>${t.title}</strong></a> — ${t.tagline}${from ? ` (from ${formatPrice(from)})` : ''}</li>`;
  }).join('');
  const { sendEmail, tmplManual } = await import('@/lib/email');
  const { escapeHtml } = await import('@/lib/sanitize');
  const html = tmplManual(
    // BLD-1385: firstName is unauthenticated user input — escape before splicing
    // into the raw HTML body (same pattern as lib/client-loyalty.ts's tmplManual calls).
    `<p>Hi ${escapeHtml(firstName) || 'there'},</p><p>Here are the treatments our finder suggested for you:</p><ol>${rows}</ol><p>Your clinician will confirm the right plan at a complimentary consultation — <a href="${base}/consultation">book yours here</a>.</p>`,
  );
  const res = await sendEmail({ to: email, subject: 'Your treatment matches — KClinics', html });
  if (!res.ok) return NextResponse.json({ ok: false, error: 'We couldn’t send the email just now — please try again.' }, { status: 502 });

  // Stable event ID shared with the browser pixel so Meta CAPI can deduplicate
  // (PRJ-1118.9 — same pattern as /api/consult and GroupBookingForm).
  const eventId = d.eventId || globalThis.crypto.randomUUID();

  // Server-side Lead conversion (GA4 + Meta CAPI), best-effort. No email is
  // forwarded to Meta's advanced matching: this form's consent line covers only
  // the results send (see comment above), not marketing — matching ConsultForm's
  // opt-in gate, which is absent here.
  try {
    const { sendLead } = await import('@/lib/conversions');
    const { consentFromCookieHeader } = await import('@/lib/attribution');
    const { analyticsConsent, marketingConsent } = consentFromCookieHeader(req.headers.get('cookie'));
    await sendLead({
      eventId,
      clientId: client.id,
      email: null,
      sourceUrl: req.headers.get('referer'),
      analyticsConsent, marketingConsent,
    });
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true, eventId });
}
