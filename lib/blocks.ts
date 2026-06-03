// Structured content blocks for the Journal — the source of truth for
// admin-authored posts. Pure & isomorphic (no server-only / node imports) so
// it runs in the block editor (client) and the renderer/API (server) alike.
//
//   blocks  ──blocksToHtml──▶  HTML  (stored in Post.content, public render + SEO)
//   HTML    ──htmlToBlocks──▶  blocks (imported WordPress posts become editable)
//
// Inline text is lightweight markdown: **bold**  _italic_  `code`  [label](url).

export type BlockType =
  | 'heading' | 'paragraph' | 'list' | 'quote' | 'image' | 'callout' | 'cta' | 'divider' | 'html';

export type Block =
  | { id: string; type: 'heading'; level: 2 | 3; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'list'; ordered: boolean; items: string[] }
  | { id: string; type: 'quote'; text: string; cite?: string }
  | { id: string; type: 'image'; src: string; alt?: string; caption?: string }
  | { id: string; type: 'callout'; text: string }
  | { id: string; type: 'cta'; label: string; href: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'html'; html: string };

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading', paragraph: 'Text', list: 'List', quote: 'Quote',
  image: 'Image', callout: 'Callout', cta: 'Button', divider: 'Divider', html: 'Raw HTML',
};

let n = 0;
export const uid = () => `b${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function emptyBlock(type: BlockType): Block {
  switch (type) {
    case 'heading': return { id: uid(), type: 'heading', level: 2, text: '' };
    case 'list': return { id: uid(), type: 'list', ordered: false, items: [''] };
    case 'quote': return { id: uid(), type: 'quote', text: '', cite: '' };
    case 'image': return { id: uid(), type: 'image', src: '', alt: '', caption: '' };
    case 'callout': return { id: uid(), type: 'callout', text: '' };
    case 'cta': return { id: uid(), type: 'cta', label: '', href: '' };
    case 'divider': return { id: uid(), type: 'divider' };
    case 'html': return { id: uid(), type: 'html', html: '' };
    default: return { id: uid(), type: 'paragraph', text: '' };
  }
}

export const starterBlocks = (): Block[] => [
  { id: uid(), type: 'heading', level: 2, text: '' },
  { id: uid(), type: 'paragraph', text: '' },
];

// ── Rendering ────────────────────────────────────────────────────────────────
const escHtml = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s: string) => escHtml(s).replace(/"/g, '&quot;');
const safeUrl = (s: string) => { const u = String(s || '').trim(); return /^(https?:\/\/|\/|mailto:|tel:)/i.test(u) ? u : ''; };

/** Render lightweight markdown inline syntax to safe HTML. */
export function inlineToHtml(text: string): string {
  let s = escHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const u = safeUrl(url); return u ? `<a href="${escAttr(u)}">${label}</a>` : label;
  });
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\\*_`])_([^_\n]+)_/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return s.replace(/\n/g, '<br />');
}

/** Convert a contentEditable's HTML back into our inline markdown storage. */
export function htmlToInline(html: string): string {
  let s = String(html || '');
  s = s.replace(/<div><br\s*\/?><\/div>/gi, '\n');
  s = s.replace(/<(div|p)\b[^>]*>/gi, '\n').replace(/<\/(div|p)>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '_$2_');
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  s = s.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
  return s.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/^\n+/, '').trimEnd();
}

export function blocksToHtml(blocks: Block[]): string {
  if (!Array.isArray(blocks)) return '';
  return blocks.map((b) => {
    switch (b.type) {
      case 'heading': return b.text.trim() ? `<h${b.level}>${inlineToHtml(b.text)}</h${b.level}>` : '';
      case 'paragraph': return b.text.trim() ? `<p>${inlineToHtml(b.text)}</p>` : '';
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        const items = (b.items || []).filter((i) => i.trim()).map((i) => `<li>${inlineToHtml(i)}</li>`).join('');
        return items ? `<${tag}>${items}</${tag}>` : '';
      }
      case 'quote': return b.text.trim()
        ? `<blockquote><p>${inlineToHtml(b.text)}</p>${b.cite?.trim() ? `<cite>${inlineToHtml(b.cite)}</cite>` : ''}</blockquote>` : '';
      case 'image': { const src = safeUrl(b.src); return src
        ? `<figure><img src="${escAttr(src)}" alt="${escAttr(b.alt || '')}" loading="lazy" />${b.caption?.trim() ? `<figcaption>${inlineToHtml(b.caption)}</figcaption>` : ''}</figure>` : ''; }
      case 'callout': return b.text.trim() ? `<aside class="journal-callout">${inlineToHtml(b.text)}</aside>` : '';
      case 'cta': { const href = safeUrl(b.href); return href && b.label.trim()
        ? `<p class="journal-cta"><a href="${escAttr(href)}">${inlineToHtml(b.label)}</a></p>` : ''; }
      case 'divider': return '<hr />';
      case 'html': return (b.html || '').trim();
      default: return '';
    }
  }).filter(Boolean).join('\n');
}

/** Plain text of a post's blocks — for excerpts and read-time estimates. */
export function blocksToText(blocks: Block[]): string {
  if (!Array.isArray(blocks)) return '';
  return blocks.map((b) => {
    if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote' || b.type === 'callout') return b.text || '';
    if (b.type === 'list') return (b.items || []).join(' ');
    if (b.type === 'image') return b.caption || '';
    return '';
  }).join(' ').replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
}

export const readMinutesOf = (blocks: Block[]) =>
  Math.max(1, Math.min(60, Math.round(blocksToText(blocks).split(' ').filter(Boolean).length / 200)));

// ── Importing existing HTML → blocks (so WordPress posts become editable) ─────
const decode = (s: string) => String(s || '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘')
  .replace(/&#8220;/g, '“').replace(/&#8221;/g, '”').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&#8230;/g, '…');

/** Turn inline HTML back into our markdown so it round-trips through the editor. */
function inlineToText(html: string): string {
  let s = String(html || '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div)>/gi, '\n');
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '_$2_');
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  s = s.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  s = s.replace(/<[^>]+>/g, '');
  return decode(s).replace(/\n{2,}/g, '\n').trim();
}

const attr = (tag: string, name: string) => { const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i')); return m ? m[1] : ''; };

export function htmlToBlocks(html: string): Block[] {
  const src = String(html || '').trim();
  if (!src) return starterBlocks();
  const blocks: Block[] = [];
  const re = /<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>|<p\b[^>]*>([\s\S]*?)<\/p>|<(ul|ol)\b[^>]*>([\s\S]*?)<\/\4>|<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>|<figure\b[^>]*>([\s\S]*?)<\/figure>|<img\b([^>]*?)\/?>|<hr\b[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  let matched = false;
  while ((m = re.exec(src))) {
    matched = true;
    if (m[1]) blocks.push({ id: uid(), type: 'heading', level: m[1].toLowerCase() === 'h3' ? 3 : 2, text: inlineToText(m[2]) });
    else if (m[3] !== undefined) { const t = inlineToText(m[3]); if (t) blocks.push({ id: uid(), type: 'paragraph', text: t }); }
    else if (m[4]) {
      const items = [...m[5].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => inlineToText(x[1])).filter(Boolean);
      blocks.push({ id: uid(), type: 'list', ordered: m[4].toLowerCase() === 'ol', items: items.length ? items : [''] });
    } else if (m[6] !== undefined) blocks.push({ id: uid(), type: 'quote', text: inlineToText(m[6]) });
    else if (m[7] !== undefined) {
      const imgM = m[7].match(/<img\b([^>]*)>/i);
      const cap = m[7].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
      blocks.push({ id: uid(), type: 'image', src: imgM ? attr(imgM[1], 'src') : '', alt: imgM ? attr(imgM[1], 'alt') : '', caption: cap ? inlineToText(cap[1]) : '' });
    } else if (m[8] !== undefined) blocks.push({ id: uid(), type: 'image', src: attr(m[8], 'src'), alt: attr(m[8], 'alt'), caption: '' });
    else blocks.push({ id: uid(), type: 'divider' });
  }
  // Couldn't recognise the structure — keep everything in one editable raw block.
  if (!matched) return [{ id: uid(), type: 'html', html: src }];
  return blocks.length ? blocks : starterBlocks();
}

/** Coerce an unknown JSON value (Prisma) into a Block[] we can trust. */
export function asBlocks(value: unknown): Block[] | null {
  if (!Array.isArray(value)) return null;
  const ok = value.filter((b): b is Block => !!b && typeof b === 'object' && typeof (b as Block).type === 'string');
  return ok.length ? ok.map((b) => ({ ...b, id: b.id || uid() })) : null;
}
