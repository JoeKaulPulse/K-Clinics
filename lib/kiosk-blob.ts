import 'server-only';
import type { PutBlobResult } from '@vercel/blob';

// Not exported by @vercel/blob's public types — mirrors its internal PutBody.
type PutBody = File | Blob | ArrayBuffer;

// BLD-798: kiosk selfies live in PRIVATE Vercel Blob storage. This is the one
// server-side read path, shared by the photo-view relay and the AI analysis.
// Legacy sessions uploaded before the switch hold public URLs — those fall back
// to a plain fetch until the 30-day kiosk cleanup purges them.
export async function fetchKioskBlob(url: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const { get } = await import('@vercel/blob');
    const r = await get(url, { access: 'private', abortSignal: AbortSignal.timeout(15_000) });
    if (r?.stream) {
      const bytes = await new Response(r.stream).arrayBuffer();
      return { bytes, contentType: r.blob?.contentType || r.headers.get('content-type') || contentTypeFromPath(url) };
    }
  } catch { /* not a private blob (legacy public upload) — fall through */ }
  try {
    // PRJ-939.13/BLD-878: cap the read — the AI call beside this is capped at
    // 30s, but a hung blob fetch used to eat the handler's whole budget first.
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

/**
 * Upload a kiosk selfie, preferring PRIVATE access (BLD-798) and falling back
 * to PUBLIC only if the connected Blob store rejects private uploads outright.
 *
 * BLD-1304: production's Blob store is provisioned public-only, so every
 * `put(..., { access: 'private' })` call was rejected server-side with
 * "Cannot use private access on a public store. The store must be configured
 * with private access." — a hard exception, not a graceful failure, so the
 * upload route 500'd before a photo was ever stored and the session sat at
 * ACTIVE forever (no photo → no analysis kicked off). This mirrors the read
 * side (fetchKioskBlob, above), which already tolerates both tiers — legacy
 * public uploads fall through to a plain fetch. The pathname keeps no
 * directory listing and embeds the high-entropy session token, so a public
 * fallback blob is still effectively unguessable; re-provision the store as
 * private (Vercel dashboard → Storage → Blob) to restore the private tier —
 * once that's done this helper's `catch` path simply stops firing.
 */
export async function putKioskBlob(
  pathname: string,
  data: PutBody,
  opts: { addRandomSuffix: boolean; contentType: string },
): Promise<PutBlobResult> {
  const { put } = await import('@vercel/blob');
  try {
    return await put(pathname, data, { ...opts, access: 'private' });
  } catch (e) {
    if (e instanceof Error && /private access on a public store/i.test(e.message)) {
      console.warn('[kiosk] Blob store is public-only — uploaded with public access instead of private (BLD-1304); re-provision the store as private when possible.');
      return await put(pathname, data, { ...opts, access: 'public' });
    }
    throw e;
  }
}
