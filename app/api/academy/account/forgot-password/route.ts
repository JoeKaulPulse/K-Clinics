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
    if (!(await enforceRateLimit(req, 'academy-forgot', 5, 900, 'academy'))) return NextResponse.json({ ok: true });
    // BLD-1645: per-IP alone lets an attacker spread requests across IPs to
    // email-bomb one victim's inbox — also cap attempts against the target
    // address itself.
    if (!(await enforceAccountRateLimit(req, parsed.data.email, 'academy-forgot-account', 5, 900, 'academy'))) return NextResponse.json({ ok: true });
    const { requestAcademyPasswordReset } = await import('@/lib/academy-auth');
    await requestAcademyPasswordReset(parsed.data.email);
  } catch (err) {
    console.error('[academy/forgot-password] failed:', (err as Error)?.message);
    Sentry.captureException(err, { tags: { area: 'academy/forgot-password' } });
  }
  return NextResponse.json({ ok: true });
}
