import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manage retail orders (status + fulfilment). These change money/fulfilment
// state, so require finance.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('finance.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ ok: false }, { status: 400 });
  const { db } = await import('@/lib/db');

  // When marking an order as REFUNDED, issue the actual Stripe refund first.
  if (body.status === 'REFUNDED') {
    const order = await db.order.findUnique({ where: { id: body.id }, select: { stripePaymentIntentId: true, totalPence: true, status: true } });
    if (!order) return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    if (order.status === 'REFUNDED') return NextResponse.json({ ok: false, error: 'Order already refunded.' }, { status: 409 });
    if (order.stripePaymentIntentId) {
      const { stripe, stripeEnabled } = await import('@/lib/stripe');
      if (!stripeEnabled) return NextResponse.json({ ok: false, error: 'Stripe not configured.' }, { status: 503 });
      try {
        await stripe().refunds.create(
          { payment_intent: order.stripePaymentIntentId, amount: order.totalPence },
          { idempotencyKey: `order-refund-${body.id}` },
        );
      } catch (e) {
        return NextResponse.json({ ok: false, error: (e as Error).message || 'Refund failed at Stripe.' }, { status: 502 });
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (body.status && ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'].includes(body.status)) data.status = body.status;
  if (body.fulfillment && ['unfulfilled', 'shipped', 'collected'].includes(body.fulfillment)) data.fulfillment = body.fulfillment;
  if (body.trackingNote !== undefined) data.trackingNote = body.trackingNote ? String(body.trackingNote).slice(0, 300) : null;
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: 'Nothing to update.' }, { status: 400 });

  // Fetch order before update so we can detect fulfillment transitions.
  const prevOrder = await db.order.findUnique({
    where: { id: body.id },
    select: { email: true, number: true, fulfillment: true, method: true, trackingNote: true },
  });

  await db.order.update({ where: { id: body.id }, data });
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary: `Updated order ${body.id}` });

  // Send dispatch/collection-ready email when fulfillment first transitions to shipped or collected.
  if (prevOrder && body.fulfillment && prevOrder.fulfillment !== body.fulfillment &&
      (body.fulfillment === 'shipped' || body.fulfillment === 'collected')) {
    try {
      const { sendEmail, emailShell } = await import('@/lib/email');
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
      const tracking = esc(String(body.trackingNote || prevOrder.trackingNote || ''));
      const num = esc(prevOrder.number);
      const isCollect = body.fulfillment === 'collected';
      const subject = isCollect ? `Your KClinics order ${prevOrder.number} is ready to collect` : `Your KClinics order ${prevOrder.number} has been dispatched`;
      const body2 = isCollect
        ? `<h1 style="font-size:22px;margin:0 0 10px;">Ready to collect</h1><p>Order <strong>${num}</strong> is ready for you at the clinic.${tracking ? ` <em>${tracking}</em>` : ''}</p><p style="font-size:14px;color:#91766e;">Pop in at your convenience — we're looking forward to seeing you.</p>`
        : `<h1 style="font-size:22px;margin:0 0 10px;">On its way</h1><p>Order <strong>${num}</strong> has been dispatched.${tracking ? ` ${tracking}` : ''}</p><p style="font-size:14px;color:#91766e;">If you have any questions about your delivery please reply to this email.</p>`;
      await sendEmail({ to: prevOrder.email, subject, html: emailShell({ body: body2, preheader: subject }) });
    } catch { /* non-fatal */ }
  }

  revalidatePath('/admin/orders');
  return NextResponse.json({ ok: true });
}
