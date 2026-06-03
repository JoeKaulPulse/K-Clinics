// Visual email builder blocks → email-safe, inline-styled HTML (the body that
// goes inside emailShell). Pure module so the composer can live-preview it.
export type Align = 'left' | 'center' | 'right';

export type EmailBlock =
  | { type: 'heading'; text: string; align?: Align }
  | { type: 'subheading'; text: string; align?: Align }
  | { type: 'paragraph'; text: string; align?: Align }
  | { type: 'list'; items: string[] }
  | { type: 'image'; url: string; alt?: string; href?: string }
  | { type: 'button'; label: string; href: string; align?: Align }
  | { type: 'spacer'; size?: 'sm' | 'md' | 'lg' }
  | { type: 'divider' };

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const INK = '#2a2420';
const GOLD = '#a98a6d';
const STONE = '#5b4f47';
const SPACER_PX: Record<string, number> = { sm: 10, md: 24, lg: 44 };

// ── Personalisation / merge tags ─────────────────────────────────────────────
// Tokens authors can drop into the subject or any text block. Replaced
// per-recipient at send time; the composer previews them with sample values.
export type MergeContext = { first_name?: string; last_name?: string; name?: string; email?: string };
export const MERGE_TAGS: { tag: string; label: string }[] = [
  { tag: '{{first_name}}', label: 'First name' },
  { tag: '{{last_name}}', label: 'Last name' },
  { tag: '{{name}}', label: 'Full name' },
  { tag: '{{email}}', label: 'Email' },
];

/** Replace {{first_name}} etc. Missing values fall back to a friendly default
 *  for the name fields ("there") and empty string otherwise. */
export function applyMergeTags(text: string, ctx: MergeContext): string {
  const first = (ctx.first_name || '').trim();
  const last = (ctx.last_name || '').trim();
  const full = (ctx.name || [first, last].filter(Boolean).join(' ')).trim();
  const map: Record<string, string> = {
    first_name: first || 'there',
    last_name: last,
    name: full || 'there',
    email: (ctx.email || '').trim(),
  };
  return String(text ?? '').replace(/\{\{\s*(first_name|last_name|name|email)\s*\}\}/g, (_, k) => map[k] ?? '');
}

export function emailBlockToHtml(b: EmailBlock): string {
  const align = 'align' in b && b.align ? b.align : 'left';
  switch (b.type) {
    case 'heading':
      return `<h2 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:${INK};text-align:${align};">${esc(b.text)}</h2>`;
    case 'subheading':
      return `<h3 style="margin:0 0 10px;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${GOLD};text-align:${align};">${esc(b.text)}</h3>`;
    case 'paragraph':
      return `<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${STONE};text-align:${align};">${esc(b.text).replace(/\n/g, '<br>')}</p>`;
    case 'list':
      return (b.items || []).filter((i) => i.trim()).length
        ? `<ul style="margin:0 0 14px;padding-left:20px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:${STONE};">${(b.items || []).filter((i) => i.trim()).map((i) => `<li style="margin:0 0 4px;">${esc(i)}</li>`).join('')}</ul>`
        : '';
    case 'image': {
      if (!b.url) return '';
      const img = `<img src="${esc(b.url)}" alt="${esc(b.alt ?? '')}" style="max-width:100%;border-radius:10px;display:block;" />`;
      return `<p style="margin:0 0 14px;">${b.href ? `<a href="${esc(b.href)}" style="text-decoration:none;">${img}</a>` : img}</p>`;
    }
    case 'button':
      return `<p style="margin:6px 0 18px;text-align:${align};"><a href="${esc(b.href || '#')}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-family:Helvetica,Arial,sans-serif;font-size:14px;">${esc(b.label || 'Book now')}</a></p>`;
    case 'spacer':
      return `<div style="height:${SPACER_PX[b.size || 'md']}px;line-height:${SPACER_PX[b.size || 'md']}px;font-size:1px;">&nbsp;</div>`;
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e7dccf;margin:18px 0;" />`;
    default:
      return '';
  }
}

export const emailBlocksToHtml = (blocks: EmailBlock[]): string => (blocks || []).map(emailBlockToHtml).join('\n');

export const blankBlock = (type: EmailBlock['type']): EmailBlock => {
  switch (type) {
    case 'heading': return { type, text: 'Your headline', align: 'left' };
    case 'subheading': return { type, text: 'Section label', align: 'left' };
    case 'paragraph': return { type, text: 'Write your message here…', align: 'left' };
    case 'list': return { type, items: ['First point', 'Second point'] };
    case 'image': return { type, url: '', alt: '', href: '' };
    case 'button': return { type, label: 'Book now', href: 'https://kclinics.co.uk/book', align: 'left' };
    case 'spacer': return { type, size: 'md' };
    case 'divider': return { type };
  }
};
