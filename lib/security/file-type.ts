import 'server-only';

// ── BLD-1576: real file type from the leading bytes ─────────────────────────
// Upload routes allow-list on the browser-supplied Content-Type, which is empty
// for a genuine photo on some mobile browsers and file managers (the reason the
// MIME check used to be skipped whenever the type was blank). Sniffing the
// magic bytes gives the routes a trustworthy type for exactly that case, so a
// blank Content-Type is neither waved through nor a false rejection.
//
// Only the types the upload routes accept are recognised; anything else returns
// null and the caller rejects it. This is not a substitute for the declared
// type when one is present — it is the fallback when there isn't one.

const ascii = (b: Uint8Array, from: number, len: number) =>
  String.fromCharCode(...b.subarray(from, from + len));

// ISO-BMFF brands that mean "still image", not video.
const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);
const AVIF_BRANDS = new Set(['avif', 'avis']);

/** Detect an uploaded file's type from its first bytes. Returns a MIME string
 *  for JPEG/PNG/WebP/GIF/AVIF/HEIF images and PDFs, or null if unrecognised. */
export async function sniffFileMime(file: Blob): Promise<string | null> {
  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    return null;
  }
  if (head.length < 12) return null;

  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head[0] === 0x89 && ascii(head, 1, 3) === 'PNG') return 'image/png';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') return 'image/webp';
  if (ascii(head, 0, 4) === 'GIF8') return 'image/gif';
  if (ascii(head, 0, 5) === '%PDF-') return 'application/pdf';
  if (ascii(head, 4, 4) === 'ftyp') {
    const brand = ascii(head, 8, 4);
    if (HEIF_BRANDS.has(brand)) return 'image/heic';
    if (AVIF_BRANDS.has(brand)) return 'image/avif';
  }
  return null;
}

/** The type an upload route should validate and store: what the client declared
 *  when it declared anything, otherwise what the bytes say. Empty when neither
 *  is available, which every caller's allow-list rejects. */
export async function effectiveFileMime(file: Blob & { type?: string }): Promise<string> {
  return file.type || (await sniffFileMime(file)) || '';
}
