import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public. Returns a result for the mobile flow's result screen. The photo URL is
// intentionally omitted from the response (privacy — it's never shown back).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await db.kioskResult.findUnique({
    where: { id },
    select: {
      id: true, headline: true, skinScore: true, smileScore: true,
      insights: true, treatments: true, shareSlug: true, shareCount: true,
      shareCaption: true,
    },
  });
  if (!result) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, result });
}
