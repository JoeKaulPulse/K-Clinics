import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-528: passwordless trainee activation (offer "accept & pay" magic link).
// Validates the one-time token, opens an academy session, and lands the trainee
// on the step that matters (the pay page from the offer email) — or the portal.
// Listed in the middleware public allowlist so it's reachable without a session.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') || '';
  const id = searchParams.get('id') || '';
  // Only ever redirect to an internal /academy path (prevents open-redirect abuse).
  const rawNext = searchParams.get('next') || '';
  const next = /^\/academy\/[A-Za-z0-9/_-]*$/.test(rawNext) ? rawNext : '/academy/portal';
  const back = (notice: string) => NextResponse.redirect(new URL(`/academy/portal?notice=${notice}`, req.url));

  const { crmEnabled } = await import('@/lib/crm');
  if (!crmEnabled || !token || !id) return back('link-invalid');

  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'academy-activate', 30, 600, 'academy'))) return back('too-many');

  const { activateStudent } = await import('@/lib/academy-auth');
  const result = await activateStudent(id, token);
  if (!result.ok) return back('link-expired');

  const { createAcademySession } = await import('@/lib/auth');
  await createAcademySession({ sub: result.student.id, email: result.student.email, firstName: result.student.firstName, epoch: result.student.sessionEpoch });

  return NextResponse.redirect(new URL(next, req.url));
}
