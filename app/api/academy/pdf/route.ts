import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-529: authenticated proxy for view-only lesson PDFs. The raw (public) Blob
// URL is never exposed to the page; the file is streamed only to a signed-in
// trainee who is enrolled, in the access window, and whose module is released.
// Served inline (no attachment) and rendered by the in-app viewer with no
// download/print chrome — see components/academy/SecurePdfViewer.tsx.
export async function GET(req: Request) {
  if (!crmEnabled) return new NextResponse('Not found', { status: 404 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return new NextResponse('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const lessonId = url.searchParams.get('lesson') || '';
  const index = Number(url.searchParams.get('i') || '0');
  if (!lessonId || !Number.isInteger(index) || index < 0) return new NextResponse('Bad request', { status: 400 });

  const { resolveLessonPdf } = await import('@/lib/lms');
  const src = await resolveLessonPdf(student.id, lessonId, index);
  if (!src) return new NextResponse('Not found', { status: 404 });

  const upstream = await fetch(src).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) return new NextResponse('Upstream error', { status: 502 });

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
