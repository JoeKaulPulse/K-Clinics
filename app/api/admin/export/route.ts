import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // large databases can take a while to stream

// Full database export (backup / migration). OWNER only — this is the entire
// dataset including all PII/PHI. Streamed as a downloadable JSON document.
export async function GET(req: Request) {
  if (!crmEnabled) return new Response('Unavailable', { status: 503 });
  const { getSession } = await import('@/lib/auth');
  const session = await getSession();
  if (!session) return new Response('Unauthorised', { status: 401 });
  if (session.role !== 'OWNER') return new Response('Owner access required.', { status: 403 });

  // Step-up: require a fresh passkey (Face ID / Touch ID) verification. The
  // export carries all PII/PHI, so an OWNER session alone isn't enough — a
  // stolen session or leaked key can't pull the data without the biometric.
  const { cookies } = await import('next/headers');
  const { verifyUnlock, unlockCookie } = await import('@/lib/webauthn');
  const unlock = (await cookies()).get(unlockCookie('export'))?.value;
  if (!(await verifyUnlock(unlock, session.sub, 'export'))) {
    return new Response('Passkey verification required.', { status: 401 });
  }

  // Rate limit — this is an expensive, highly sensitive operation.
  const { enforceRateLimit } = await import('@/lib/security/guard');
  if (!(await enforceRateLimit(req, 'full-export', 6, 3600, 'admin'))) {
    return new Response('Too many export requests. Please try again later.', { status: 429 });
  }

  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'DATA_EXPORTED', actor: session.email, actorRole: session.role, summary: 'Full database export downloaded' }).catch(() => {});

  const { fullExportStream } = await import('@/lib/data-export');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return new Response(fullExportStream(session.email), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="kclinics-full-export-${stamp}.json"`,
      'cache-control': 'no-store',
    },
  });
}
