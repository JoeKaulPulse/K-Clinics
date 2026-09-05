import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Finance planner model edits. Requires finance.manage AND an active finance
// unlock (the same PIN/passkey step-up that gates the page) — the model is
// financial data, so API writes hold the same bar as reading the page.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('finance.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const { financeUnlocked } = await import('@/lib/finance-lock');
  if (!(await financeUnlocked(session.sub))) {
    return NextResponse.json({ ok: false, error: 'Finance unlock expired — unlock again.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { logAudit } = await import('@/lib/audit');

  if (body.op === 'save') {
    if (!body.inputs || typeof body.inputs !== 'object' || Array.isArray(body.inputs)) {
      return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    }
    const { savePlannerInputs } = await import('@/lib/finance-planner');
    await savePlannerInputs(body.inputs, session.email);
    await logAudit({
      action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role,
      summary: `Finance planner updated: ${Object.keys(body.inputs).slice(0, 8).join(', ').slice(0, 120)}`,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'reset') {
    const { resetPlannerInputs } = await import('@/lib/finance-planner');
    await resetPlannerInputs();
    await logAudit({
      action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role,
      summary: 'Finance planner reset to defaults',
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
