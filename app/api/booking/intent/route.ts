import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTreatment } from '@/lib/treatments';

export const runtime = 'nodejs';

// BLD-838: optional "email me my selection" capture from the public booking
// funnel. Stores a specific-treatment follow-up intent (legitimate interest) —
// no account is created and no marketing list is touched. The consent gate (a
// hard unsubscribe if the email maps to a known client) is applied at send time
// in the recovery automation, not here.
const schema = z.object({
  email: z.string().email(),
  treatmentSlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  variantLabel: z.string().max(120).optional(),
  company: z.string().max(0).optional().or(z.literal('')), // honeypot
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 422 });
  if (parsed.data.company) return NextResponse.json({ ok: true }); // honeypot tripped — silent no-op
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'booking-intent', 5, 600))) return NextResponse.json({ ok: false, error: 'Please try again shortly.' }, { status: 429 });

  // Only accept a real treatment slug — resolves the title we store & email.
  const treatment = getTreatment(parsed.data.treatmentSlug);
  if (!treatment) return NextResponse.json({ ok: false, error: 'Unknown treatment.' }, { status: 422 });

  const email = parsed.data.email.trim().toLowerCase();
  const variantLabel = parsed.data.variantLabel?.trim() || null;
  try {
    const { db } = await import('@/lib/db');
    // Dedupe: don't stack a second row for the same email+treatment within 24h.
    // Refresh the newest recent row's variant instead (they changed their pick).
    const since = new Date(Date.now() - 24 * 3600e3);
    const recent = await db.bookingIntent.findFirst({
      where: { email, treatmentSlug: treatment.slug, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, variantLabel: true },
    });
    if (recent) {
      if (variantLabel && variantLabel !== recent.variantLabel) {
        await db.bookingIntent.update({ where: { id: recent.id }, data: { variantLabel } }).catch(() => {});
      }
    } else {
      await db.bookingIntent.create({
        data: { email, treatmentSlug: treatment.slug, treatmentTitle: treatment.title, variantLabel, source: 'funnel' },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not save.' }, { status: 500 });
  }
}
