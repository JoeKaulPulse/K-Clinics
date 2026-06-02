import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const str = (v: unknown, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('suppliers.view');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  switch (b.op) {
    case 'list': {
      const rows = await db.supplier.findMany({
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        take: 300,
        select: { id: true, name: true, category: true, contactName: true, email: true, phone: true, accountNumber: true, xeroContactId: true, active: true },
      });
      return NextResponse.json({ ok: true, suppliers: rows });
    }
    case 'get': {
      if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
      const s = await db.supplier.findUnique({
        where: { id: String(b.id) },
        include: { calls: { orderBy: { startedAt: 'desc' }, take: 20, select: { id: true, direction: true, startedAt: true, durationSec: true, fromNumber: true, toNumber: true } } },
      });
      if (!s) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json({ ok: true, supplier: { ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(), calls: s.calls.map((c) => ({ ...c, startedAt: c.startedAt.toISOString() })) } });
    }
    case 'upsert': {
      const manage = await requirePermission('suppliers.manage');
      if (!manage) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
      const name = str(b.name, 160);
      if (!name) return NextResponse.json({ ok: false, error: 'A supplier name is required.' }, { status: 422 });
      const data = {
        name, category: str(b.category, 60), contactName: str(b.contactName, 120),
        email: str(b.email, 160), phone: str(b.phone, 40), website: str(b.website, 200),
        addressLine: str(b.addressLine, 200), city: str(b.city, 80), postcode: str(b.postcode, 20),
        country: str(b.country, 2) || 'GB', accountNumber: str(b.accountNumber, 80),
        notes: str(b.notes, 2000), xeroContactId: str(b.xeroContactId, 80),
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
      };
      const row = b.id
        ? await db.supplier.update({ where: { id: String(b.id) }, data })
        : await db.supplier.create({ data: { ...data, createdBy: session.email } });
      return NextResponse.json({ ok: true, id: row.id });
    }
    case 'remove': {
      const manage = await requirePermission('suppliers.manage');
      if (!manage) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
      if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
      // Soft-delete to preserve call history links.
      await db.supplier.update({ where: { id: String(b.id) }, data: { active: false } });
      return NextResponse.json({ ok: true });
    }
    case 'bills': {
      if (!b.id) return NextResponse.json({ ok: false }, { status: 400 });
      const s = await db.supplier.findUnique({ where: { id: String(b.id) }, select: { xeroContactId: true } });
      if (!s?.xeroContactId) return NextResponse.json({ ok: false, error: 'This supplier isn’t linked to a Xero contact.' }, { status: 400 });
      const { getSupplierBills } = await import('@/lib/xero');
      const res = await getSupplierBills(s.xeroContactId);
      return NextResponse.json(res);
    }
    case 'importXero': {
      const manage = await requirePermission('suppliers.manage');
      if (!manage) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
      const { getXeroSupplierContacts } = await import('@/lib/xero');
      const res = await getXeroSupplierContacts();
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error || 'Could not reach Xero.' }, { status: 400 });
      let created = 0, updated = 0;
      for (const x of res.suppliers) {
        const existing = await db.supplier.findFirst({ where: { OR: [{ xeroContactId: x.xeroContactId }, { name: x.name }] }, select: { id: true } });
        const data = { name: x.name, email: x.email, phone: x.phone, website: x.website, accountNumber: x.accountNumber, addressLine: x.addressLine, city: x.city, postcode: x.postcode, country: x.country, xeroContactId: x.xeroContactId };
        if (existing) { await db.supplier.update({ where: { id: existing.id }, data }); updated++; }
        else { await db.supplier.create({ data: { ...data, createdBy: session.email } }); created++; }
      }
      return NextResponse.json({ ok: true, created, updated });
    }
  }
  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}
