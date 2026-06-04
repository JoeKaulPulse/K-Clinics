import { NextResponse } from 'next/server';
import { assessmentSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  return xff ? xff.split(',')[0].trim() : req.headers.get('x-real-ip');
}

export async function POST(req: Request) {
  if (!crmEnabled) {
    return NextResponse.json({ ok: false, error: 'Not enabled in this environment.' }, { status: 503 });
  }
  const parsed = assessmentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid submission.' }, { status: 422 });
  }

  const { getClientSession } = await import('@/lib/auth');
  const session = await getClientSession();
  if (!session) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  // Record the language the client filled the form in (their saved preference),
  // so staff get an accurate translation and the original is always preserved.
  let sourceLocale = 'en';
  // Only attach a bookingId if it actually belongs to this client (don't let a
  // crafted request link an assessment to someone else's booking).
  let bookingId: string | null = null;
  try {
    const { db } = await import('@/lib/db');
    const c = await db.client.findUnique({ where: { id: session.sub }, select: { locale: true } });
    sourceLocale = c?.locale === 'uk' ? 'uk' : 'en';
    if (parsed.data.bookingId) {
      const owned = await db.booking.findFirst({ where: { id: parsed.data.bookingId, clientId: session.sub }, select: { id: true } });
      bookingId = owned?.id ?? null;
    }
  } catch { /* default en */ }

  const { saveAssessment } = await import('@/lib/health-assessments');
  try {
    const res = await saveAssessment({
      clientId: session.sub,
      questionnaireKey: parsed.data.key,
      answers: parsed.data.answers,
      sourceLocale,
      bookingId,
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true, ...res });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not save your assessment.' }, { status: 500 });
  }
}
