import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import { RENEWAL_CATEGORIES } from '@/lib/renewals-shared';

export const runtime = 'nodejs';

// Compliance & renewals CRUD (BLD-587). View is gated by compliance.view (the
// page); all writes need compliance.manage.
const CATS = new Set<string>(RENEWAL_CATEGORIES as readonly string[]);
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const date = (v: unknown) => { const d = new Date(String(v)); return isNaN(+d) ? null : d; };
const intOrNull = (v: unknown) => (v === '' || v == null || isNaN(Number(v)) ? null : Math.round(Number(v)));

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('compliance.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Managing compliance needs permission.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  try {
    switch (b.op) {
      case 'create':
      case 'update': {
        const name = str(b.name, 120);
        const renewalAt = date(b.renewalAt);
        if (!name) return NextResponse.json({ ok: false, error: 'A name is required.' }, { status: 400 });
        if (!renewalAt) return NextResponse.json({ ok: false, error: 'A valid renewal date is required.' }, { status: 400 });
        const data = {
          name,
          category: CATS.has(str(b.category)) ? str(b.category) : 'Other',
          provider: str(b.provider, 120) || null,
          reference: str(b.reference, 120) || null,
          renewalAt,
          costPence: intOrNull(b.costPence),
          notes: str(b.notes, 4000) || null,
          reminderDays: Array.isArray(b.reminderDays)
            ? b.reminderDays.map(Number).filter((n: number) => Number.isFinite(n) && n > 0 && n <= 365).slice(0, 6)
            : [90, 60, 30],
        };
        if (b.op === 'create') {
          const item = await db.complianceItem.create({ data: { ...data, createdBy: session.email } });
          return NextResponse.json({ ok: true, id: item.id });
        }
        if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
        await db.complianceItem.update({ where: { id: String(b.id) }, data });
        return NextResponse.json({ ok: true });
      }
      case 'renew': {
        const renewalAt = date(b.renewalAt);
        if (!b.id || !renewalAt) return NextResponse.json({ ok: false, error: 'Pick the new renewal date.' }, { status: 400 });
        // Reset the reminder cycle so the new period alerts afresh.
        await db.complianceItem.update({
          where: { id: String(b.id) },
          data: { renewalAt, lastRenewedAt: new Date(), lastRemindedDays: null, ...(b.costPence !== undefined ? { costPence: intOrNull(b.costPence) } : {}) },
        });
        return NextResponse.json({ ok: true });
      }
      case 'delete': {
        if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 });
        await db.complianceItem.delete({ where: { id: String(b.id) } });
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
  } catch (e) {
    console.error('[compliance] op failed', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong — please retry.' }, { status: 500 });
  }
}
