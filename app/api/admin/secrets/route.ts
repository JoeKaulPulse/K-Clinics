import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner-managed credential store. GET returns each catalogued secret's presence
// + source (never the value); POST sets one; DELETE clears one. Highest-privilege
// settings action — gated on settings.manage and audited.

export async function GET() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const { secretStatus } = await import('@/lib/secrets');
  return NextResponse.json({ ok: true, secrets: await secretStatus() });
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { name, value } = (await req.json().catch(() => ({}))) as { name?: string; value?: string };
  if (!name || typeof value !== 'string' || !value.trim()) return NextResponse.json({ ok: false, error: 'A name and value are required.' }, { status: 400 });

  try {
    const { setSecret } = await import('@/lib/secrets');
    await setSecret(name, value.trim(), session!.email);
    const { logAudit } = await import('@/lib/audit');
    await logAudit({ action: 'SETTINGS_UPDATED', actor: session!.email, actorRole: session!.role, summary: `Set credential ${name} (in-app)` }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message || 'Could not save.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name) return NextResponse.json({ ok: false, error: 'Missing name.' }, { status: 400 });
  const { clearSecret } = await import('@/lib/secrets');
  await clearSecret(name);
  const { logAudit } = await import('@/lib/audit');
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session!.email, actorRole: session!.role, summary: `Cleared credential ${name} (in-app)` }).catch(() => {});
  return NextResponse.json({ ok: true });
}
