import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Bulk price-list import from the clinic's .xlsx. POST a file (multipart) to get
// a preview of the parsed sections; POST JSON { op:'commit', sections } to write
// them as Services + variants. Requires settings.manage.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const { db } = await import('@/lib/db');
  const { treatments, getTreatment } = await import('@/lib/treatments');
  const treatmentOpts = treatments.map((t) => ({ slug: t.slug, title: t.title }));

  // ── Preview: parse the uploaded spreadsheet ──
  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No file uploaded.' }, { status: 400 });
    if (file.size > 6 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'File is over 6 MB.' }, { status: 413 });
    try {
      const { parsePricelistXlsx } = await import('@/lib/xlsx-pricelist');
      const buf = new Uint8Array(await file.arrayBuffer());
      const { sections, warnings } = parsePricelistXlsx(buf, treatmentOpts);
      return NextResponse.json({
        ok: true, warnings,
        sections: sections.map((s) => ({
          header: s.header, slugGuess: s.slugGuess, raw: s.raw, count: s.variants.length,
          samples: s.variants.slice(0, 3).map((v) => `${v.name} — £${(v.pricePence / 100).toLocaleString('en-GB')}`),
        })),
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: 'Could not read that file. Please upload the .xlsx price list.', detail: (e as Error)?.message }, { status: 400 });
    }
  }

  // ── Commit: write the confirmed sections ──
  const body = await req.json().catch(() => ({}));
  if (body.op !== 'commit' || !Array.isArray(body.sections)) return NextResponse.json({ ok: false, error: 'Bad request.' }, { status: 400 });
  const { parsePriceMatrix } = await import('@/lib/price-import');
  const { logAudit } = await import('@/lib/audit');

  let services = 0, variantCount = 0; const skipped: string[] = [];
  for (const sec of body.sections as { treatmentSlug?: string; serviceName?: string; raw?: string }[]) {
    const treatmentSlug = String(sec.treatmentSlug || '').trim();
    if (!treatmentSlug || !sec.raw) { skipped.push(sec.serviceName || sec.treatmentSlug || '?'); continue; }
    const { variants } = parsePriceMatrix(sec.raw);
    if (!variants.length) { skipped.push(sec.serviceName || treatmentSlug); continue; }
    const category = getTreatment(treatmentSlug)?.category === 'dentistry' ? 'dentistry' : 'aesthetics';
    const name = (sec.serviceName || getTreatment(treatmentSlug)?.title || treatmentSlug).slice(0, 120);

    // Find-or-create the service for this treatment, then replace its variants.
    let svc = await db.service.findFirst({ where: { treatmentSlug }, select: { id: true } });
    if (!svc) {
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44);
      const order = await db.service.count();
      svc = await db.service.create({ data: { slug: `${base}-${Date.now().toString(36).slice(-4)}`, treatmentSlug, name, category, order }, select: { id: true } });
      services++;
    }
    await db.serviceVariant.deleteMany({ where: { serviceId: svc.id } });
    await db.serviceVariant.createMany({
      data: variants.map((v, i) => ({ serviceId: svc!.id, name: v.name.slice(0, 120), durationMin: Math.max(5, v.durationMin), pricePence: Math.max(0, v.pricePence), courses: v.courses.length ? v.courses : undefined, order: i })),
    });
    variantCount += variants.length;
  }
  await logAudit({ action: 'SERVICE_PRICES_BULK', actor: session.email, actorRole: session.role, summary: `Bulk price-list import: ${variantCount} variants across ${body.sections.length} section(s)` }).catch(() => {});

  // Refresh the public price surfaces so the new "from" prices show immediately.
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/', 'layout');

  return NextResponse.json({ ok: true, services, variants: variantCount, skipped });
}
