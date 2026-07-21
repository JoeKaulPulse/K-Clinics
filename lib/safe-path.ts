// PRJ-1032.1: safe post-login return path. The old guard
// `from.startsWith('/') && !from.startsWith('//')` accepted `/\evil.com`, which
// the WHATWG URL parser (and Next's router) resolve to `https://evil.com/` —
// an open redirect. This helper rejects every host-bearing form so a return
// path can only ever be a genuine same-origin path.
//
// Edge- and client-safe (pure string logic, no imports) so the OAuth routes and
// the login forms can share one implementation.
export function safeReturnPath(from: unknown, fallback: string): string {
  if (typeof from !== 'string' || from.length === 0) return fallback;
  if (!from.startsWith('/')) return fallback;      // must be root-relative
  if (from.startsWith('//')) return fallback;      // protocol-relative → host
  if (from.includes('\\')) return fallback;        // backslash → '/' in URL parsers
  if (from.includes('://')) return fallback;       // embedded scheme (defensive)
  if (/[\x00-\x1f\x7f]/.test(from)) return fallback; // control chars / newlines
  return from;
}
