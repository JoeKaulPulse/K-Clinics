import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { LOCALE_COOKIE } from '@/lib/locale';
import { isLocale } from '@/lib/i18n';

export const runtime = 'nodejs';

// Set the signed-in staff member's CRM language. Stores a cookie (read by both
// server and client) and persists the preference to their profile so it follows
// them to any device.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });

  const { locale } = await req.json().catch(() => ({}));
  if (!isLocale(locale)) return NextResponse.json({ ok: false, error: 'Unsupported language.' }, { status: 400 });

  // Persist to the profile (best-effort — the cookie is the source of truth for rendering).
  try {
    const { db } = await import('@/lib/db');
    await db.adminUser.update({ where: { id: session.sub }, data: { locale } });
  } catch {
    /* don't block the language switch on a write blip */
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set(LOCALE_COOKIE, locale, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
