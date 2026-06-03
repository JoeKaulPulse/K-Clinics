import { NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { TREATMENT_CONTENT_TAG } from '@/lib/treatment-content';

export const runtime = 'nodejs';

// Per-treatment marketing content override. Requires settings.manage.
const cleanList = (v: unknown): { [k: string]: string }[] =>
  Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? x : {})) as { [k: string]: string }[] : [];
const toCsv = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : [];

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });
  const editor = (session as { email?: string }).email ?? null;

  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug || '').trim();
  if (!slug) return NextResponse.json({ ok: false, error: 'No treatment.' }, { status: 400 });
  const { db } = await import('@/lib/db');

  const revalidate = () => { revalidateTag(TREATMENT_CONTENT_TAG); revalidateTag(`treatment-${slug}`); revalidatePath(`/${slug}`); };

  if (body.op === 'reset') {
    await db.treatmentContent.delete({ where: { slug } }).catch(() => {});
    revalidate();
    return NextResponse.json({ ok: true });
  }

  // Empty string → null so the static default shows through for that field.
  const s = (v: unknown) => { const t = String(v ?? '').trim(); return t ? t.slice(0, 4000) : null; };
  const data = {
    title: s(body.title), tagline: s(body.tagline), eyebrow: s(body.eyebrow), intro: s(body.intro),
    metaTitle: s(body.metaTitle), metaDescription: s(body.metaDescription), priceFrom: s(body.priceFrom),
    keywords: toCsv(body.keywords), related: toCsv(body.related),
    benefits: cleanList(body.benefits).filter((b) => b.title || b.text),
    process: cleanList(body.process).filter((b) => b.title || b.text),
    faqs: cleanList(body.faqs).filter((b) => b.q || b.a),
    facts: cleanList(body.facts).filter((b) => b.label || b.value),
    updatedBy: editor,
  };

  await db.treatmentContent.upsert({ where: { slug }, update: data, create: { slug, ...data } });
  revalidate();
  return NextResponse.json({ ok: true });
}
