import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { isLocale } from '@/lib/i18n';

export const runtime = 'nodejs';

// Set the signed-in client's portal language. Persists to their account and
// sets the kc_clang cookie (read by both server and client) so it follows them.
export async function POST(req: Request) {
  const { locale } = await req.json().catch(() => ({}));
  if (!isLocale(locale)) return NextResponse.json({ ok: false, error: 'Unsupported language.' }, { status: 400 });

  // Persist to the account if signed in (best-effort — cookie drives rendering).
  if (crmEnabled) {
    try {
      const { getClientSession } = await import('@/lib/auth');
      const session = await getClientSession();
      if (session) {
        const { db } = await import('@/lib/db');
        await db.client.update({ where: { id: session.sub }, data: { locale } });
      }
    } catch {
      /* don't block the language switch on a write blip */
    }
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set('kc_clang', locale, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
