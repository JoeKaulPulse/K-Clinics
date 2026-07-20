import 'server-only';

// BLD-798: kiosk selfies live in PRIVATE Vercel Blob storage. This is the one
// server-side read path, shared by the photo-view relay and the AI analysis.
// Legacy sessions uploaded before the switch hold public URLs — those fall back
// to a plain fetch until the 30-day kiosk cleanup purges them.
export async function fetchKioskBlob(url: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const { get } = await import('@vercel/blob');
    const r = await get(url, { access: 'private' });
    if (r?.stream) {
      const bytes = await new Response(r.stream).arrayBuffer();
      return { bytes, contentType: r.blob?.contentType || r.headers.get('content-type') || contentTypeFromPath(url) };
    }
  } catch { /* not a private blob (legacy public upload) — fall through */ }
  try {
    const res = await fetch(url);
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
