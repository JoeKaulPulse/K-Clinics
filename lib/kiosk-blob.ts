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
 * Thrown when the connected Blob store cannot accept a PRIVATE upload because
 * it is provisioned public-only. Kept distinct from every other upload failure
 * so the routes can tell the visitor the truth ("temporarily unavailable",
 * retrying won't help) and raise a config-shaped ops alert, instead of a
 * generic "please try again" that can never succeed. (BLD-1304)
 */
export class KioskBlobStorePublicOnlyError extends Error {
  readonly code = 'kiosk_blob_store_public_only';
  constructor(cause?: unknown) {
    super(
      'Vercel Blob store is provisioned public-only, so kiosk selfies cannot be stored privately. '
      + 'Kiosk photo upload stays disabled until the store is re-provisioned with private access '
      + '(Vercel dashboard → Storage → Blob). See BLD-1304 / BLD-798.',
      { cause },
    );
    this.name = 'KioskBlobStorePublicOnlyError';
  }
}

/**
 * Upload a kiosk selfie to PRIVATE Vercel Blob storage. Private access is not
 * negotiable here — see the decision record below.
 *
 * BLD-1304: the connected production Blob store is provisioned public-only, so
 * every `put(..., { access: 'private' })` call is rejected server-side with
 * "Cannot use private access on a public store. The store must be configured
 * with private access." That hard-fails the upload, so no photo is stored and
 * the AI analysis never runs. Confirmed live in the Vercel runtime error log
 * (route /api/kiosk/sessions/[token]/photo, still firing 13 Aug).
 *
 * REVIEW DECISION (13 Aug, pre-merge) — a public-access fallback was proposed
 * to get the feature working again tonight. It is deliberately NOT taken,
 * because it reverses an explicit prior privacy decision on biometric data
 * without owner sign-off:
 *   - BLD-798 moved these selfies to private storage precisely because they
 *     "were public, unauthenticated URLs viewable by anyone for 30 days"
 *     (see app/api/kiosk/sessions/[token]/photo-view/route.ts). A public
 *     fallback recreates exactly that state.
 *   - The fallback's stated mitigation — that the pathname embeds a
 *     high-entropy session token — does not hold. randomToken(10) is ~50 bits
 *     and lib/kiosk.ts describes this same token as "short, brute-forceable";
 *     BLD-1052 therefore made the read relay require the paired 166-bit secret
 *     AND rate-limit it. A raw public blob URL carries no secret, no rate
 *     limit, no expiry check and no revocation, so it is strictly weaker than
 *     the bar an earlier board item already set for reading this same image.
 *     The token is displayed in-clinic as a QR/URL on the kiosk screen, so it
 *     is not a secret to begin with.
 * Broken-but-safe is the better one-night trade: a privacy regression on
 * visitors' face photos cannot be un-shipped, and the runtime logs show no
 * genuine visitor uploads in the last 7 days (the only two failures were the
 * visual-QA harness's own test sessions).
 *
 * Fix path is an owner action, not a code change: re-provision the Blob store
 * with private access (Vercel dashboard → Storage → Blob). Nothing here needs
 * to change once that is done — this error simply stops being thrown.
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
      throw new KioskBlobStorePublicOnlyError(e);
    }
    throw e;
  }
}
