import { NextResponse } from 'next/server';
import { consultSchema } from '@/lib/validation';
import { crmEnabled } from '@/lib/crm';
import { site } from '@/lib/site';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  const parsed = consultSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.errors[0]?.message || 'Validation failed' },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // Honeypot — silently accept to fool bots.
  if (data.company) return NextResponse.json({ ok: true });

  // Without a DB/email backend (e.g. the static demo), report graceful fallback
  // so the form can switch to a mailto: handoff.
  if (!crmEnabled) {
    return NextResponse.json({ ok: false, fallback: 'mailto', email: site.email });
  }

  // Lazy-load server-only deps so the module stays importable when CRM is off.
  const { db } = await import('@/lib/db');
  const { sendEmail, tmplConsultReply, tmplClinicNotify } = await import('@/lib/email');

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');

  try {
    // Upsert the client (dedupe by email) and attach a consultation + timeline.
    const client = await db.client.upsert({
      where: { email: data.email.toLowerCase() },
      update: {
        firstName: data.firstName,
        lastName: data.lastName || undefined,
        phone: data.phone || undefined,
        dob: data.dob ? new Date(data.dob) : undefined,
        marketingOptIn: data.marketingOptIn || undefined,
      },
      create: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        dob: data.dob ? new Date(data.dob) : null,
        source: 'website',
        marketingOptIn: data.marketingOptIn,
      },
    });

    await db.consultation.create({
      data: {
        clientId: client.id,
        category: data.category,
        treatments: data.treatments,
        concerns: data.concerns || null,
        message: data.message || null,
        preferredTime: data.preferredTime || null,
        preferredContact: data.preferredContact || null,
        status: 'NEW',
      },
    });

    await db.interaction.create({
      data: {
        clientId: client.id,
        type: 'SYSTEM',
        summary: 'Consultation request submitted via website',
        detail: data.message || null,
      },
    });

    // Fire emails (don't block the response on provider latency-failures).
    const notifyTo = process.env.CLINIC_NOTIFY_EMAIL || site.email;
    const [reply, notify] = await Promise.all([
      sendEmail({ to: data.email, subject: 'We received your enquiry — K Clinics', html: tmplConsultReply(data.firstName) }),
      sendEmail({
        to: notifyTo,
        subject: `New consultation — ${fullName}`,
        html: tmplClinicNotify({ name: fullName, email: data.email, phone: data.phone, category: data.category, treatments: data.treatments, message: data.message }),
      }),
    ]);

    await db.emailEvent.createMany({
      data: [
        { clientId: client.id, kind: 'CONSULT_REPLY', to: data.email, subject: 'Consultation received', status: reply.ok ? 'SENT' : 'FAILED', providerId: reply.id, error: reply.error },
        { clientId: client.id, kind: 'CONSULT_NOTIFY', to: notifyTo, subject: 'New consultation', status: notify.ok ? 'SENT' : 'FAILED', providerId: notify.id, error: notify.error },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('consult error', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again or call us.' }, { status: 500 });
  }
}
