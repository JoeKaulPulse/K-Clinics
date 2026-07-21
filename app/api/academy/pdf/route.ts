import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// A distinct, loggable reason for every denial (BLD-865) — a generic 401/404 with
// no detail meant a real student-side access-check failure (e.g. an enrolment not
// yet flipped to PAID, or a lapsed cohort access window) looked identical to a bad
// request, and staff — who only ever preview via the raw admin Blob link, never
// this proxy — had no code path that would reproduce or diagnose it.
// Only the reasons that indicate a real access-state condition worth diagnosing
// go to Sentry — plain unauthenticated/bad-request hits (expired session, a bot,
// a stray request) are expected background noise, not a signal.
const REPORTABLE_REASONS = new Set(['not-enrolled', 'locked', 'lesson-not-found', 'bad-index', 'upstream-error']);

function denyWithReason(reason: string, status: number, studentId: string | null, lessonId: string) {
  if (REPORTABLE_REASONS.has(reason)) {
    Sentry.captureMessage('[academy/pdf] access denied', { level: 'info', tags: { reason }, extra: { studentId, lessonId } });
  }
  return NextResponse.json({ ok: false, reason }, { status });
}

// BLD-529: authenticated proxy for view-only lesson PDFs. The raw (public) Blob
// URL is never exposed to the page; the file is streamed only to a signed-in
// trainee who is enrolled, in the access window, and whose module is released.
// Served inline (no attachment) and rendered by the in-app viewer with no
// download/print chrome — see components/academy/SecurePdfViewer.tsx.
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 404 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);

  const url = new URL(req.url);
  const lessonId = url.searchParams.get('lesson') || '';
  const index = Number(url.searchParams.get('i') || '0');

  if (!student) return denyWithReason('unauthenticated', 401, null, lessonId);
  if (!lessonId || !Number.isInteger(index) || index < 0) return denyWithReason('bad-request', 400, student.id, lessonId);

  const { resolveLessonPdf } = await import('@/lib/lms');
  const resolved = await resolveLessonPdf(student.id, lessonId, index);
  if (resolved.url === null) return denyWithReason(resolved.reason, resolved.reason === 'lesson-not-found' || resolved.reason === 'bad-index' ? 404 : 403, student.id, lessonId);
  const src = resolved.url;

  // SSRF guard: only ever proxy the Vercel Blob store these PDFs are uploaded to —
  // never an arbitrary host, even if a bad URL somehow reached the DB.
  let host = '';
  try { host = new URL(src).hostname; } catch { return denyWithReason('bad-index', 404, student.id, lessonId); }
  if (!host.endsWith('.public.blob.vercel-storage.com')) return denyWithReason('bad-index', 404, student.id, lessonId);

  const upstream = await fetch(src).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) return denyWithReason('upstream-error', 502, student.id, lessonId);

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
