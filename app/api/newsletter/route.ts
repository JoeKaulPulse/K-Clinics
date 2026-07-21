import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
  // BLD-691: which surface captured the signup (attribution was blind before).
  source: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
});

// Public newsletter sign-up. Explicit, single opt-in with a stored consent
// timestamp + unsubscribe token. Idempotent on email.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not available right now.' }, { status: 503 });
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 422 });
  if (parsed.data.company) return NextResponse.json({ ok: true }); // honeypot tripped
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'newsletter', 5, 600))) return NextResponse.json({ ok: false, error: 'Please try again shortly.' }, { status: 429 });

  const email = parsed.data.email.trim().toLowerCase();
  try {
    const { db } = await import('@/lib/db');
    const sub = await db.newsletterSubscriber.upsert({
      where: { email },
      update: { active: true, consentedAt: new Date() },
      create: { email, source: parsed.data.source || 'footer' },
    });
    // Single opt-in confirmation with one-click unsubscribe (fire-and-forget;
    // a mail hiccup never fails the subscribe).
    try {
      const base = (process.env.NEXT_PUBLIC_SITE_URL || (await import('@/lib/site')).site.url).replace(/\/$/, '');
      const unsubUrl = `${base}/api/unsubscribe?t=${sub.unsubToken}`;
      const { sendEmail, tmplNewsletterWelcome } = await import('@/lib/email');
      await sendEmail({
        to: email,
        subject: 'You’re subscribed — KClinics',
        html: tmplNewsletterWelcome(unsubUrl),
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
