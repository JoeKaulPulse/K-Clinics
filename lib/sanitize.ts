// Pure, dependency-free HTML utilities — safe to import on BOTH server and client
// (no `server-only`, no node/jsdom imports), so the isomorphic block renderer
// (lib/blocks.ts), the public journal renderer and the email builder can all
// share one hardened implementation.
//
// Why hand-rolled and not DOMPurify/sanitize-html: the block renderer is
// explicitly isomorphic, and a jsdom-backed sanitizer would (a) not run in that
// module and (b) add real serverless cold-start cost. This is a CONSERVATIVE
// ALLOWLIST sanitizer for *semi-trusted* CMS HTML (admin-authored Journal "raw
// HTML" blocks + imported WordPress posts) — it strips scripts, styles, event
// handlers, javascript: URLs and any non-allowlisted element/attribute.

/** Escape the 5 HTML-significant characters. Use for ANY untrusted value spliced
 *  into an HTML context (email bodies/merge tags, attributes, text nodes). */
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Tags kept (everything else is unwrapped — its inner text is preserved).
// Covers everything lib/blocks.ts can emit (incl. aside/figure/figcaption/cite)
// plus normal long-form article markup so legitimate content is never mangled.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'span', 'div', 'section', 'article', 'aside', 'header', 'footer',
  'blockquote', 'cite', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'small', 'mark', 'sup', 'sub', 'abbr',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
]);

// Elements removed together with their content (we never want their innards).
const DROP_WITH_CONTENT = 'script|style|iframe|object|embed|form|noscript|svg|math|template|title|head|select|option|textarea|button|frame|frameset|applet|link|meta|base';

const GLOBAL_ATTRS = new Set(['id', 'class', 'title', 'dir', 'lang', 'colspan', 'rowspan', 'align', 'width', 'height']);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'name']),
  img: new Set(['src', 'alt', 'loading', 'decoding']),
};
const URL_ATTRS = new Set(['href', 'src', 'cite']);
const VOID_TAGS = new Set(['br', 'hr', 'img', 'col']);

/** Decode the numeric/named entity forms an attacker could use to hide a scheme
 *  like "javascript:" inside a URL attribute, plus control chars browsers strip.
 *  Keep the control-character class written as ESCAPES (\x00-\x1f\x7f): it used
 *  to be those raw bytes inline, which is the same regex but made git treat this
 *  source file as binary, so its diffs could not be reviewed. */
function decodeForScheme(s: string): string {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h) => { const n = parseInt(h, 16); return Number.isFinite(n) ? String.fromCharCode(n) : ''; })
    .replace(/&#([0-9]+);?/g, (_m, d) => { const n = parseInt(d, 10); return Number.isFinite(n) ? String.fromCharCode(n) : ''; })
    .replace(/[\x00-\x1f\x7f]/g, '');
}

/** Allow only http(s), root-relative, anchor, mailto and tel URLs. Everything
 *  else (javascript:, data:, vbscript:, ...) becomes empty -> the attribute drops.
 *
 *  BLD-1597: the entity-decoded/control-stripped form is used ONLY to decide
 *  whether the scheme is safe; a URL that passes returns the ORIGINAL trimmed
 *  string, so the decoded form is never written back into the page. It used to
 *  be, and the two can differ in a way that matters: `&#47;&#47;evil.com`
 *  decodes to `//evil.com`, and emitting THAT as the href turned an inert
 *  literal into a live protocol-relative link to someone else's origin.
 *  Returning the original leaves the `&` for escapeHtml to escape, so the
 *  browser sees the literal text and resolves it same-origin.
 *
 *  Checking the decoded form while returning the raw one is only safe because
 *  decodeForScheme strips a SUPERSET of what a browser strips from a URL (every
 *  C0 control + DEL, vs the browser's tab/CR/LF): anything a browser would still
 *  read as `javascript:` we have already collapsed to `javascript:` as well, so
 *  this check can over-block but never under-block. */
function safeUrl(raw: string): string {
  const original = String(raw || '').trim();
  const decoded = decodeForScheme(original);
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(decoded) ? original : '';
}

export function sanitizeHtml(input: unknown): string {
  let s = String(input ?? '');
  // 1) Strip comments (can hide conditional-comment / mXSS payloads).
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // 2) Remove dangerous elements together with their content.
  s = s.replace(new RegExp(`<(${DROP_WITH_CONTENT})\\b[\\s\\S]*?</\\1\\s*>`, 'gi'), '');
  // 3) Remove any stray opening/standalone dangerous tags left over.
  s = s.replace(new RegExp(`</?(${DROP_WITH_CONTENT})\\b[^>]*>`, 'gi'), '');
  // 4) Rewrite every remaining tag through the allowlist (quoted attrs may hold '>').
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*?)\s*\/?>/g, (_m, close, rawName, rawAttrs) => {
    const tag = String(rawName).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ''; // unwrap: drop the tag, keep inner text
    if (close) return `</${tag}>`;
    const allowed = TAG_ATTRS[tag] || new Set<string>();
    const kept: string[] = [];
    let targetBlank = false;
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(rawAttrs))) {
      const key = a[1].toLowerCase();
      let val = a[2] ? a[2].replace(/^["']|["']$/g, '') : '';
      if (key.startsWith('on')) continue;                       // event handlers
      if (key === 'style' || key === 'srcdoc' || key === 'formaction') continue;
      if (!(allowed.has(key) || GLOBAL_ATTRS.has(key))) continue;
      if (URL_ATTRS.has(key)) { const u = safeUrl(val); if (!u) continue; val = u; }
      if (key === 'target' && /_blank/i.test(val)) targetBlank = true;
      kept.push(`${key}="${escapeHtml(val)}"`);
    }
    // Defang reverse-tabnabbing on new-tab links.
    if (tag === 'a' && targetBlank && !kept.some((k) => k.startsWith('rel='))) kept.push('rel="noopener noreferrer"');
    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}${VOID_TAGS.has(tag) ? ' /' : ''}>`;
  });
  return s;
}
