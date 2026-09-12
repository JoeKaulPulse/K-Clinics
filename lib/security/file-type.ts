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

// PRJ-1191.11: effectiveFileMime above only fills in a BLANK declared type — a
// staff upload route that trusts a PRESENT declared type is still trivially
// bypassed (e.g. an HTML/SVG file with embedded script, relabelled
// "image/png", sails through an allow-list that only checks file.type). Two
// families the same sniffer sometimes reports under slightly different names
// than a real client would declare — not a spoof, just naming variance.
const EQUIVALENT_MIME = [new Set(['image/jpg', 'image/jpeg']), new Set(['image/heic', 'image/heif'])];
// Declared-type families sniffFileMime can fingerprint. Every image type either
// upload route accepts (png/jpeg/webp/gif/avif/heic/heif) and PDF start with
// fixed magic bytes, so for these a null sniff means the bytes contradict the
// label rather than that this module lacks a check.
const VERIFIABLE_DECLARED = /^(image\/|application\/pdf$)/;
function mimeFamiliesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return EQUIVALENT_MIME.some((set) => set.has(a) && set.has(b));
}

/** The type an upload route should TRUST. Any image or PDF — declared as one
 *  or sniffed as one — must be backed by matching magic bytes, or it is
 *  rejected outright (empty return): that covers both a wrong label (GIF bytes
 *  declared image/png) and no label the bytes support at all (an HTML/SVG
 *  payload declared image/png), which is the whole mislabelled-file bypass.
 *  Only a format `sniffFileMime` cannot fingerprint AND that isn't claiming to
 *  be an image/PDF (video/audio/office docs/zip) falls back to the declared
 *  type unverified, same as `effectiveFileMime` — the trust gap is exactly the
 *  formats this module has no magic-byte check for, rather than any file that
 *  happens not to sniff. */
export async function verifiedFileMime(file: Blob & { type?: string }): Promise<string> {
  const sniffed = await sniffFileMime(file);
  const declared = (file.type || '').toLowerCase();
  if (sniffed) {
    if (declared && !mimeFamiliesMatch(declared, sniffed)) return ''; // mismatch — reject
    return sniffed;
  }
  // Review fix (PRJ-1191.11): bytes in no format sniffFileMime recognises.
  // Falling back to the declared type here unconditionally left the bypass
  // this function exists to close wide open — the attacker's file is PRECISELY
  // the unsniffable case. An HTML/SVG/script payload has no magic bytes, so
  // sniffing returns null and declaring it "image/png" sailed straight through
  // both callers' allow-lists. The fallback is only legitimate where this
  // module genuinely cannot fingerprint the format, so it is now scoped to
  // exactly that: a declared type in a family sniffFileMime DOES cover
  // (any image/*, application/pdf) with bytes that don't back it up is a lie,
  // not a coverage gap, and is rejected. video/audio/office-doc/zip — which
  // have no magic-byte check here — still fall back to the declared type,
  // unchanged.
  if (VERIFIABLE_DECLARED.test(declared)) return '';
  return declared;
}
