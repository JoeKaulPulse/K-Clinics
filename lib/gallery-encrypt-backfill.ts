import 'server-only';
import { db } from '@/lib/db';
import { encryptBytes, isEncryptedBytes } from '@/lib/crypto';

// BLD-1041: self-healing encryption backfill for legacy PLAINTEXT gallery
// before/after photos. New writes are keyring-encrypted at the admin API;
// this nightly pass upgrades the rows that predate the change, bounded per
// run because each row carries megabytes of image data. Latches off via a
// Settings key once a full pass finds nothing left, same pattern as the
// clinical-encryption backfill (BLD-248). The serve route's decryptBytes
// tolerates plaintext, so reads work identically before, during and after.

const DONE_KEY = 'gallery_encrypt_backfill_v1';
const BATCH = 40; // rows migrated per nightly run

export async function backfillGalleryEncryptionIfNeeded(): Promise<{ ran: boolean; migrated: number; complete: boolean }> {
  const done = await db.setting.findUnique({ where: { key: DONE_KEY } }).catch(() => null);
  if (done?.value === 'true') return { ran: false, migrated: 0, complete: true };

  const ids = await db.galleryItem.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } }).catch(() => [] as { id: string }[]);
  let migrated = 0;
  let unfinished = false;
  for (const { id } of ids) {
    if (migrated >= BATCH) { unfinished = true; break; }
    // One row at a time — two multi-MB blobs per row; never load the table.
    const row = await db.galleryItem.findUnique({ where: { id }, select: { beforeImage: true, afterImage: true, updatedAt: true } }).catch(() => null);
    if (!row) continue;
    const data: Record<string, Uint8Array<ArrayBuffer>> = {};
    if (!isEncryptedBytes(row.beforeImage)) data.beforeImage = encryptBytes(row.beforeImage);
    if (!isEncryptedBytes(row.afterImage)) data.afterImage = encryptBytes(row.afterImage);
    if (!Object.keys(data).length) continue;
    // CAS on updatedAt so an admin replacing an image mid-backfill can never be
    // clobbered with a re-encryption of the old bytes.
    const res = await db.galleryItem.updateMany({ where: { id, updatedAt: row.updatedAt }, data }).catch(() => ({ count: 0 }));
    if (res.count > 0) migrated++;
  }
  const complete = !unfinished;
  if (complete) {
    await db.setting.upsert({ where: { key: DONE_KEY }, update: { value: 'true' }, create: { key: DONE_KEY, value: 'true' } }).catch(() => {});
  }
  return { ran: true, migrated, complete };
}
