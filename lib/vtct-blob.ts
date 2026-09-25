import 'server-only';

// BLD-1794: VTCT registration documents are government identity documents
// (Photo ID, Proof of Address, prior qualification certificates), so they live
// in PRIVATE Vercel Blob storage — the same choke-point pattern already used
// for kiosk selfies (BLD-798, lib/kiosk-blob.ts) and academy portfolio clinical
// photos (BLD-740, lib/portfolio-blob.ts). This is the one server-side read
// path, used by the authenticated document relay
// (/api/academy/vtct-registration/document).
export const VTCT_DOCUMENT_RELAY = '/api/academy/vtct-registration/document';

/** True for any https Vercel-Blob URL (public or private store). */
export function isVtctBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /\.(public|private)\.blob\.vercel-storage\.com$/.test(u.hostname);
  } catch { return false; }
}

export async function fetchVtctBlob(url: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const { get } = await import('@vercel/blob');
    const r = await get(url, { access: 'private', abortSignal: AbortSignal.timeout(15_000) });
    if (r?.stream) {
      const bytes = await new Response(r.stream).arrayBuffer();
      return { bytes, contentType: r.blob?.contentType || r.headers.get('content-type') || 'application/octet-stream' };
    }
  } catch { /* not a private blob — fall through (should not happen for a new upload) */ }
  return null;
}

/**
 * Thrown when the connected Blob store cannot accept a PRIVATE upload because
 * it is provisioned public-only. Identity documents (Photo ID, Proof of
 * Address) must never fall back to public storage — see BLD-1304, which found
 * the same failure mode for kiosk selfies and made the deliberate call to fail
 * loudly rather than reverse a privacy decision without owner sign-off. This
 * mirrors that decision exactly for a category of document that is at least as
 * sensitive (government ID, not just a face photo).
 */
export class VtctBlobStorePublicOnlyError extends Error {
  readonly code = 'vtct_blob_store_public_only';
  constructor(cause?: unknown) {
    super(
      'Vercel Blob store is provisioned public-only, so VTCT registration documents cannot be stored privately. '
      + 'Document upload stays disabled until the store is re-provisioned with private access '
      + '(Vercel dashboard -> Storage -> Blob). See BLD-1304.',
      { cause },
    );
    this.name = 'VtctBlobStorePublicOnlyError';
  }
}

/** Upload a VTCT registration document to PRIVATE Vercel Blob storage. Private
 *  access is not negotiable — see VtctBlobStorePublicOnlyError above. */
export async function putVtctBlob(
  pathname: string,
  data: File | Blob | ArrayBuffer,
  opts: { addRandomSuffix: boolean; contentType?: string },
): Promise<{ url: string }> {
  const { put } = await import('@vercel/blob');
  try {
    return await put(pathname, data, { ...opts, access: 'private' });
  } catch (e) {
    if (e instanceof Error && /private access on a public store/i.test(e.message)) {
      throw new VtctBlobStorePublicOnlyError(e);
    }
    throw e;
  }
}

// ── One-time / self-healing migration: any PUBLIC document → private store ──
// The client-direct upload route (blob-token/route.ts) requests
// access:'private', but @vercel/blob's client-token payload cannot pin the
// access level server-side (only pathname/content-type/size — verified against
// the installed SDK's HandleUploadOptions type) — the same residual gap
// lib/portfolio-blob.ts documents for BLD-740. For identity documents this is
// the same gap on more sensitive data, so it gets the same daily self-heal:
// bounded per run, retried on the next run, self-disables via a Settings key
// only once a full pass finds nothing left in the public store. Wired into the
// daily cron alongside migratePortfolioPhotosIfNeeded.
const DONE_KEY = 'vtct_document_private_migration_v1';
const DOCS_PER_RUN = 100;
const PUBLIC_BLOB_HOST = '.public.blob.vercel-storage.com';

export async function migrateVtctDocumentsIfNeeded(): Promise<{ ran: boolean; migrated: number; failed: number; complete: boolean }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ran: false, migrated: 0, failed: 0, complete: false };
  const { db } = await import('@/lib/db');
  const { put, del } = await import('@vercel/blob');

  const publicDocs = await db.vtctRegistrationDocument.findMany({
    where: { url: { contains: PUBLIC_BLOB_HOST } },
    take: DOCS_PER_RUN,
    select: { id: true, url: true, filename: true, contentType: true },
  });

  let migrated = 0;
  let failed = 0;
  for (const doc of publicDocs) {
    try {
      const res = await fetch(doc.url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const bytes = await res.arrayBuffer();
      const name = (doc.filename || 'document').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-100);
      const blob = await put(`vtct/${name}`, bytes, {
        access: 'private',
        addRandomSuffix: true,
        contentType: doc.contentType || res.headers.get('content-type') || 'application/octet-stream',
      });
      await db.vtctRegistrationDocument.update({ where: { id: doc.id }, data: { url: blob.url } });
      try { await del(doc.url); } catch { /* best-effort — the private copy already exists */ }
      migrated++;
    } catch (e) {
      failed++;
      console.error('[vtct-blob] migrate failed (continuing):', (e as Error)?.message);
    }
  }

  const remaining = await db.vtctRegistrationDocument.count({ where: { url: { contains: PUBLIC_BLOB_HOST } } });
  const complete = failed === 0 && remaining === 0;
  if (complete) {
    await db.setting.upsert({ where: { key: DONE_KEY }, update: { value: new Date().toISOString() }, create: { key: DONE_KEY, value: new Date().toISOString() } });
  }
  return { ran: true, migrated, failed, complete };
}
