import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

const MAX_BYTES = 4 * 1024 * 1024; // 4MB per image (clients downscale first)

// Decode a data URL / base64 string → { buffer, type }. Returns null if invalid.
function decodeImage(input: unknown): { buf: Uint8Array<ArrayBuffer>; type: string } | null {
  if (typeof input !== 'string' || !input) return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(input.trim());
  const b64 = m ? m[2] : input;
  const type = m ? m[1] : 'image/jpeg';
  try {
    const bin = Buffer.from(b64, 'base64');
    if (!bin.length || bin.length > MAX_BYTES) return null;
    const buf = new Uint8Array(bin.length); // fresh ArrayBuffer-backed view for Prisma Bytes
    buf.set(bin);
    return { buf, type };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');
  const { revalidatePath } = await import('next/cache');
  const ok = (extra: object = {}) => { revalidatePath('/gallery'); return NextResponse.json({ ok: true, ...extra }); };
  const bad = (error = 'Bad request') => NextResponse.json({ ok: false, error }, { status: 400 });

  switch (body.op) {
    case 'create': {
      const b = body as Record<string, unknown>;
      if (!b.category || typeof b.category !== 'string') return bad('Choose a treatment category.');
      const before = decodeImage(b.beforeImage);
      const after = decodeImage(b.afterImage);
      if (!before || !after) return bad('Both a before and an after image are required (max 4MB each).');
      const count = await db.galleryItem.count();
      const item = await db.galleryItem.create({
        data: {
          category: (b.category as string).slice(0, 60),
          treatmentSlug: (b.treatmentSlug as string)?.trim() || null,
          caption: (b.caption as string)?.slice(0, 200) || null,
          beforeImage: before.buf, beforeType: before.type,
          afterImage: after.buf, afterType: after.type,
          consent: !!b.consent,
          clientId: (b.clientId as string)?.trim() || null, // BLD-765: optional link to the depicted client for consent + erasure
          published: false,
          order: count,
          createdBy: session.email,
        },
        select: { id: true },
      });
      return ok({ id: item.id });
    }
    case 'update': {
      const b = body as Record<string, unknown>;
      if (!b.id) return bad();
      const data: Record<string, unknown> = {};
      if (typeof b.category === 'string') data.category = b.category.slice(0, 60);
      if (b.treatmentSlug !== undefined) data.treatmentSlug = (b.treatmentSlug as string)?.trim() || null;
      if (b.caption !== undefined) data.caption = (b.caption as string)?.slice(0, 200) || null;
      if (typeof b.consent === 'boolean') data.consent = b.consent;
      if (b.clientId !== undefined) data.clientId = (b.clientId as string)?.trim() || null; // BLD-765
      if (b.beforeImage) { const i = decodeImage(b.beforeImage); if (!i) return bad('Invalid before image.'); data.beforeImage = i.buf; data.beforeType = i.type; }
      if (b.afterImage) { const i = decodeImage(b.afterImage); if (!i) return bad('Invalid after image.'); data.afterImage = i.buf; data.afterType = i.type; }
      await db.galleryItem.update({ where: { id: String(b.id) }, data });
      return ok();
    }
    case 'toggle': {
      if (!body.id) return bad();
      const item = await db.galleryItem.findUnique({ where: { id: String(body.id) }, select: { consent: true } });
      if (!item) return bad('Not found.');
      // Guard: can't publish without confirming client consent.
      if (body.published && !item.consent) return bad('Confirm client consent before publishing this case.');
      await db.galleryItem.update({ where: { id: String(body.id) }, data: { published: !!body.published } });
      return ok();
    }
    case 'remove': {
      if (!body.id) return bad();
      await db.galleryItem.delete({ where: { id: String(body.id) } });
      return ok();
    }
    case 'reorder': {
      if (!Array.isArray(body.ids)) return bad();
      await Promise.all((body.ids as string[]).map((id, i) => db.galleryItem.update({ where: { id }, data: { order: i } }).catch(() => {})));
      return ok();
    }
  }
  return bad('Unknown op');
}
