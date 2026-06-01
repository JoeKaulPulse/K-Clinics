import { NextResponse } from 'next/server';
import { z } from 'zod';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.object({
  areas: z.array(z.enum(['skin', 'teeth', 'hair', 'body'])).min(1).max(4),
  images: z.array(z.object({ area: z.string().max(20).optional(), dataUrl: z.string().min(20).max(1_500_000) })).min(1).max(4),
  budgetPence: z.number().int().positive().max(5_000_000).nullable().default(null),
  budgetLabel: z.string().max(40).default('Flexible'),
  storeImages: z.boolean().default(true),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please give your consent to continue.' }) }),
});

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, reason: 'unavailable', message: 'Not available.' }, { status: 503 });

  // Account-gated.
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient().catch(() => null);
  if (!client) return NextResponse.json({ ok: false, reason: 'auth', message: 'Please sign in or create an account to use the AI consultation.' }, { status: 401 });

  const { getSetting } = await import('@/lib/settings');
  if (!(await getSetting('ai_consultation_enabled'))) {
    return NextResponse.json({ ok: false, reason: 'unavailable', message: 'The AI consultation is currently switched off.' }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: 'error', message: parsed.error.errors[0]?.message || 'Check your photos and try again.' }, { status: 422 });

  const { analyze } = await import('@/lib/ai-consultation');
  const result = await analyze({ clientId: client.id, areas: parsed.data.areas, images: parsed.data.images, storeImages: parsed.data.storeImages, budgetPence: parsed.data.budgetPence, budgetLabel: parsed.data.budgetLabel });
  return NextResponse.json(result, { status: result.ok ? 200 : (result.reason === 'limit' ? 429 : 200) });
}
