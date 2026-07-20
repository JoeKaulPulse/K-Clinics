import 'server-only';
import { db } from '@/lib/db';

// BLD-740: trainee portfolio photos are real before/after clinical photos of
// treatment subjects, so they live in PRIVATE Vercel Blob storage (parity with
// kiosk selfies, BLD-798 / lib/kiosk-blob.ts). This is the one server-side
// read path, used by the photo relay. Entries created before the switch hold
// public URLs — those fall back to a plain fetch until the daily-cron sweep
// below re-homes them into the private store.

/** The authenticated read path — photo URLs in view payloads point here. */
export const PORTFOLIO_PHOTO_RELAY = '/api/academy/portfolio/photo';

/** True for any https Vercel-Blob URL (public or private store). */
export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /\.(public|private)\.blob\.vercel-storage\.com$/.test(u.hostname);
  } catch { return false; }
}

/** True for a legacy PUBLIC blob URL (pre-BLD-740 upload, awaiting migration). */
export function isPublicBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch { return false; }
}

export async function fetchPortfolioBlob(url: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const { get } = await import('@vercel/blob');
    const r = await get(url, { access: 'private', abortSignal: AbortSignal.timeout(15_000) });
    if (r?.stream) {
      const bytes = await new Response(r.stream).arrayBuffer();
      return { bytes, contentType: r.blob?.contentType || r.headers.get('content-type') || contentTypeFromPath(url) };
    }
  } catch { /* not a private blob (legacy public upload) — fall through */ }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return { bytes: await res.arrayBuffer(), contentType: res.headers.get('content-type') || contentTypeFromPath(url) };
  } catch {
    return null;
  }
}

function contentTypeFromPath(p: string): string {
  const ext = p.split('?')[0]?.split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' || ext === 'heif' ? 'image/heic' : 'image/jpeg';
}

// ── One-time migration: legacy public photos → private store ────────────────
// Runs from the daily cron (same pattern as redactFutureClinicianEvents):
// bounded per run, retries failures on the next run, and self-disables via a
// Settings key only after a full pass finds nothing left to move.
const DONE_KEY = 'portfolio_private_migration_v1';
const PHOTOS_PER_RUN = 100;

export async function migratePortfolioPhotosIfNeeded(): Promise<{ ran: boolean; migrated: number; failed: number; complete: boolean }> {
  // Deliberately NOT short-circuited by DONE_KEY: the client upload token
  // cannot pin the blob access level (@vercel/blob 2.4.0), so a crafted upload
  // could still create a public portfolio blob after the initial migration.
  // The scan itself is the gate — with no public photos left it is a cheap
  // no-op — so any stray public clinical photo gets re-homed within a day.
  // DONE_KEY is still stamped as the "initial migration complete" record.
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ran: false, migrated: 0, failed: 0, complete: false };

  const { put, del } = await import('@vercel/blob');
  const rows = await db.portfolioEntry.findMany({ select: { id: true, photos: true } });
  let migrated = 0;
  let failed = 0;
  let remaining = 0; // public photos left untouched by this run's budget

  for (const row of rows) {
    const photos = Array.isArray(row.photos) ? (row.photos as { url?: unknown }[]) : [];
    if (!photos.some((p) => typeof p?.url === 'string' && isPublicBlobUrl(p.url))) continue;

    let changed = false;
    const oldUrls: string[] = [];
    const next = [] as typeof photos;
    for (const p of photos) {
      const url = typeof p?.url === 'string' ? p.url : '';
      if (!isPublicBlobUrl(url)) { next.push(p); continue; }
      if (migrated + failed >= PHOTOS_PER_RUN) { remaining++; next.push(p); continue; }
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const bytes = await res.arrayBuffer();
        const name = (new URL(url).pathname.split('/').pop() || 'photo.jpg').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-100);
        const blob = await put(`portfolio/${name}`, bytes, {
          access: 'private',
          addRandomSuffix: true,
          contentType: res.headers.get('content-type') || contentTypeFromPath(url),
        });
        next.push({ ...p, url: blob.url });
        oldUrls.push(url);
        migrated++;
        changed = true;
      } catch (e) {
        failed++;
        next.push(p); // keep the old URL — retried on the next run
        console.error('[portfolio-blob] migrate failed (continuing):', (e as Error)?.message);
      }
    }
    if (!changed) continue;
    try {
      await db.portfolioEntry.update({ where: { id: row.id }, data: { photos: next as unknown as object } });
      // Only remove the public originals once the entry points at the private copies.
      try { await del(oldUrls); } catch { /* best-effort — already private-first */ }
    } catch (e) {
      failed++; // entry still holds the public URLs — retried on the next run
      console.error('[portfolio-blob] entry update failed (continuing):', (e as Error)?.message);
    }
  }

  const complete = failed === 0 && remaining === 0;
  if (complete) {
    await db.setting.upsert({ where: { key: DONE_KEY }, update: { value: new Date().toISOString() }, create: { key: DONE_KEY, value: new Date().toISOString() } });
    console.log(`[portfolio-blob] private migration complete: ${migrated} photo(s) re-homed (BLD-740)`);
  }
  return { ran: true, migrated, failed, complete };
}
