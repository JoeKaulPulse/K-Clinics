import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { CATEGORIES, CATEGORY_LABEL, CATEGORY_DEFAULTS, type Category, type NotifPrefs } from '@/lib/notifications';

export const runtime = 'nodejs';

// Per-user notification preferences (Settings → Notifications). Each user manages
// their own; no special permission beyond being signed in.
export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 403 });
  const { getNotifPrefs } = await import('@/lib/notifications');
  const prefs = await getNotifPrefs(session.sub);
  return NextResponse.json({
    ok: true,
    prefs,
    categories: CATEGORIES.map((c) => ({ key: c, label: CATEGORY_LABEL[c], defaults: CATEGORY_DEFAULTS[c] })),
  });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 403 });
  const b = await req.json().catch(() => ({}));

  const inApp: Partial<Record<Category, boolean>> = {};
  const email: Partial<Record<Category, boolean>> = {};
  for (const c of CATEGORIES) {
    if (b?.inApp && typeof b.inApp[c] === 'boolean') inApp[c] = b.inApp[c];
    if (b?.email && typeof b.email[c] === 'boolean') email[c] = b.email[c];
  }
  const hhmm = (v: unknown): string | null => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : null);
  const qs = hhmm(b?.quietHours?.start), qe = hhmm(b?.quietHours?.end);
  const quietHours = qs && qe ? { start: qs, end: qe } : null;
  const digest = ['off', 'daily', 'weekly'].includes(b?.digest) ? b.digest : 'weekly';
  const prefs: NotifPrefs = { inApp, email, quietHours, digest, chatSound: Boolean(b?.chatSound) };

  const { setNotifPrefs } = await import('@/lib/notifications');
  await setNotifPrefs(session.sub, prefs);
  return NextResponse.json({ ok: true, prefs });
}
