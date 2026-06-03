// Visual email builder blocks → email-safe, inline-styled HTML (the body that
// goes inside emailShell). Pure module so the composer can live-preview it.
export type EmailBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'button'; label: string; href: string }
  | { type: 'divider' };

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const INK = '#2a2420';
const GOLD = '#a98a6d';
const STONE = '#5b4f47';

export function emailBlockToHtml(b: EmailBlock): string {
  switch (b.type) {
    case 'heading':
      return `<h2 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:${INK};">${esc(b.text)}</h2>`;
    case 'paragraph':
      return `<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${STONE};">${esc(b.text).replace(/\n/g, '<br>')}</p>`;
    case 'image':
      return b.url ? `<p style="margin:0 0 14px;"><img src="${esc(b.url)}" alt="${esc(b.alt ?? '')}" style="max-width:100%;border-radius:10px;display:block;" /></p>` : '';
    case 'button':
      return `<p style="margin:6px 0 18px;"><a href="${esc(b.href || '#')}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-family:Helvetica,Arial,sans-serif;font-size:14px;">${esc(b.label || 'Book now')}</a></p>`;
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e7dccf;margin:18px 0;" />`;
    default:
      return '';
  }
}

export const emailBlocksToHtml = (blocks: EmailBlock[]): string => (blocks || []).map(emailBlockToHtml).join('\n');

export const blankBlock = (type: EmailBlock['type']): EmailBlock => {
  switch (type) {
    case 'heading': return { type, text: 'Your headline' };
    case 'paragraph': return { type, text: 'Write your message here…' };
    case 'image': return { type, url: '', alt: '' };
    case 'button': return { type, label: 'Book now', href: 'https://kclinics.co.uk/book' };
    case 'divider': return { type };
  }
};
