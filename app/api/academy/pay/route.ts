import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-528: a trainee starts paying for an offered course (full or deposit).
// Server re-prices from the enrolment — the client never supplies an amount.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Payments aren’t available right now.' }, { status: 503 });

  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-pay', 12, 300, 'academy'))) return NextResponse.json({ ok: false, error: 'Too many attempts — please try again shortly.' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const enrolmentId = String(body.enrolmentId || '');
  const mode = body.mode === 'deposit' ? 'deposit' : 'full';
  if (!enrolmentId) return NextResponse.json({ ok: false, error: 'Missing enrolment.' }, { status: 400 });

  const { startEnrolmentPayment } = await import('@/lib/academy-payments');
  const r = await startEnrolmentPayment(student.id, enrolmentId, mode);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status ?? 400 });
  return NextResponse.json({ ok: true, clientSecret: r.clientSecret, paymentId: r.paymentId, amountPence: r.amountPence });
}
