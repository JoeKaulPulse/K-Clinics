import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type V = { id: string; key: string; weight: number };
function weightedPick<T extends V>(variants: T[]): T {
  const total = variants.reduce((s, v) => s + Math.max(1, v.weight), 0);
  let r = Math.random() * total;
  for (const v of variants) { r -= Math.max(1, v.weight); if (r <= 0) return v; }
  return variants[variants.length - 1];
}

// Public A/B endpoint: assign a sticky variant (expose) + record a CTA click
// (convert). Aggregate counters only — no per-visitor storage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || '').slice(0, 60);
  if (!slug) return NextResponse.json({ ok: false }, { status: 400 });

  const { db } = await import('@/lib/db');
  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const cookieKey = `kc_ab_${slug}`;
  const month = 60 * 60 * 24 * 30;

  if (body.op === 'expose') {
    const test = await db.abTest.findUnique({ where: { slug }, include: { variants: { orderBy: { key: 'asc' } } } });
    if (!test || test.status !== 'RUNNING' || test.variants.length === 0) return NextResponse.json({ ok: false });
    const existing = jar.get(cookieKey)?.value;
    let variant = existing ? test.variants.find((v) => v.key === existing) ?? null : null;
    let fresh = false;
    if (!variant) { variant = weightedPick(test.variants); fresh = true; await db.abVariant.update({ where: { id: variant.id }, data: { exposures: { increment: 1 } } }); }
    const res = NextResponse.json({ ok: true, key: variant.key, headline: variant.headline, subhead: variant.subhead, ctaLabel: variant.ctaLabel, ctaHref: variant.ctaHref });
    if (fresh) res.cookies.set(cookieKey, variant.key, { sameSite: 'lax', path: '/', maxAge: month });
    return res;
  }

  if (body.op === 'convert') {
    const key = jar.get(cookieKey)?.value;
    if (!key) return NextResponse.json({ ok: true });
    const convertedKey = `kc_abc_${slug}`;
    if (jar.get(convertedKey)?.value) return NextResponse.json({ ok: true }); // count once per visitor
    const v = await db.abVariant.findFirst({ where: { test: { slug }, key } });
    if (v) await db.abVariant.update({ where: { id: v.id }, data: { conversions: { increment: 1 } } });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(convertedKey, '1', { sameSite: 'lax', path: '/', maxAge: month });
    return res;
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
