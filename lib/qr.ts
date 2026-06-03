import 'server-only';
import QRCode from 'qrcode';
import { site } from '@/lib/site';

// ── Dynamic QR helpers ───────────────────────────────────────────────────────
// A QR code encodes the stable public URL /qr/{code}; the destination it
// redirects to is editable in admin, so printed codes never need reprinting.

const BASE = site.url.replace(/\/$/, '');

/** Public, stable URL that a printed QR encodes. */
export const qrUrl = (code: string) => `${BASE}/qr/${code}`;

/** A short, URL-safe, unambiguous slug (no 0/O/1/l/I) for new codes. */
export function randomCode(len = 7): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Normalise a user-entered slug to the same safe alphabet/shape. */
export const slugifyCode = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

type QrColors = { dark?: string; light?: string };

/** SVG QR for the given text (crisp at any print size, no raster). */
export function qrSvg(text: string, c: QrColors = {}): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 1,
    color: { dark: c.dark || '#000000', light: c.light || '#ffffff' },
  });
}

/** PNG data URL (for an easy "download / drop into print" button). */
export function qrPngDataUrl(text: string, c: QrColors = {}): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M', margin: 1, width: 1024,
    color: { dark: c.dark || '#000000', light: c.light || '#ffffff' },
  });
}

/** Coarse device class from a user-agent — for scan analytics, no PII. */
export function deviceFromUa(ua: string | null | undefined): string {
  const s = (ua || '').toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return 'tablet';
  if (/mobi|iphone|android.*mobile|phone/.test(s)) return 'mobile';
  if (/android/.test(s)) return 'tablet';
  return 'desktop';
}
