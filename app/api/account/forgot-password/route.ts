import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: true }); // never reveal state
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: true }); // no enumeration
  try {
    const { enforceRateLimit, enforceAccountRateLimit } = await import('@/lib/security/guard');
    if (!(await enforceRateLimit(req, 'forgot', 5, 900))) return NextResponse.json({ ok: true }); // throttle silently
    // BLD-1645: per-IP alone lets an attacker spread requests across IPs to
    // email-bomb one victim's inbox — also cap attempts against the target
    // address itself.
    if (!(await enforceAccountRateLimit(req, parsed.data.email, 'forgot-account', 5, 900))) return NextResponse.json({ ok: true });
    const { requestPasswordReset } = await import('@/lib/client-auth');
    await requestPasswordReset(parsed.data.email);
  } catch (err) {
    console.error('[forgot-password] failed:', (err as Error)?.message);
    Sentry.captureException(err, { tags: { area: 'account/forgot-password' } });
  }
  // Always succeed to avoid leaking which emails are registered.
  return NextResponse.json({ ok: true });
}
