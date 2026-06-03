// Section registry — the ACF-style "flexible content" layouts editors can add
// to a page. Pure metadata (no JSX) so it's shared by the builder (client) and
// the renderer (server). Each section's rendering lives in components/cms.
import type { Block } from './blocks';

export type FieldType = 'text' | 'textarea' | 'link' | 'toggle' | 'image' | 'select' | 'blocks' | 'list';
export type Field = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[]; // select
  itemFields?: Field[];                          // list (repeater)
  itemLabel?: string;                            // list add-button label
};

export type SectionDef = {
  type: string;
  label: string;
  glyph: string;
  description: string;
  defaults: Record<string, unknown>;
  fields: Field[];
};

export type Section = { id: string; type: string; data: Record<string, unknown>; hidden?: boolean };

let n = 0;
export const uid = () => `s${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const linkPair = (prefix: string, label: string): Field[] => [
  { key: `${prefix}Label`, label: `${label} text`, type: 'text' },
  { key: `${prefix}Href`, label: `${label} link`, type: 'link', placeholder: '/book' },
];

export const SECTION_DEFS: SectionDef[] = [
  {
    type: 'hero', label: 'Hero', glyph: '◖', description: 'Full-width page header with heading, intro and buttons.',
    defaults: { eyebrow: '', title: 'Heading', lede: '', image: '', ctaPrimaryLabel: 'Book now', ctaPrimaryHref: '/book', ctaSecondaryLabel: '', ctaSecondaryHref: '' },
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text', placeholder: 'Established 2026 · Islington' },
      { key: 'title', label: 'Heading', type: 'textarea' },
      { key: 'lede', label: 'Intro', type: 'textarea' },
      { key: 'image', label: 'Background image', type: 'image', help: 'Optional — falls back to generative art.' },
      ...linkPair('ctaPrimary', 'Primary button'),
      ...linkPair('ctaSecondary', 'Secondary button'),
    ],
  },
  {
    type: 'richText', label: 'Rich text', glyph: '¶', description: 'A block of formatted content (headings, lists, images…).',
    defaults: { blocks: [] as Block[], width: 'narrow' },
    fields: [
      { key: 'width', label: 'Width', type: 'select', options: [{ value: 'narrow', label: 'Narrow (reading)' }, { value: 'wide', label: 'Wide' }] },
      { key: 'blocks', label: 'Content', type: 'blocks' },
    ],
  },
  {
    type: 'imageText', label: 'Image + text', glyph: '▤', description: 'Two-column image alongside a heading and copy.',
    defaults: { eyebrow: '', heading: 'Heading', body: '', image: '', side: 'left', ctaLabel: '', ctaHref: '' },
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea', help: 'Separate paragraphs with a blank line.' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'side', label: 'Image side', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
      ...linkPair('cta', 'Button'),
    ],
  },
  {
    type: 'featureGrid', label: 'Feature grid', glyph: '▦', description: 'A grid of titled cards — values, benefits, services.',
    defaults: { eyebrow: '', heading: 'Heading', intro: '', columns: '2', items: [{ title: 'Title', text: 'Description' }] },
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'intro', label: 'Intro', type: 'textarea' },
      { key: 'columns', label: 'Columns', type: 'select', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }] },
      { key: 'items', label: 'Cards', type: 'list', itemLabel: 'card', itemFields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'text', label: 'Text', type: 'textarea' }] },
    ],
  },
  {
    type: 'stats', label: 'Stats', glyph: '◫', description: 'A row of headline numbers.',
    defaults: { items: [{ value: '100%', label: 'Satisfaction' }] },
    fields: [
      { key: 'items', label: 'Stats', type: 'list', itemLabel: 'stat', itemFields: [{ key: 'value', label: 'Value', type: 'text' }, { key: 'label', label: 'Label', type: 'text' }] },
    ],
  },
  {
    type: 'cta', label: 'Call to action', glyph: '◎', description: 'A centred banner with a heading and button.',
    defaults: { eyebrow: '', heading: 'Ready to begin?', text: '', ctaLabel: 'Book now', ctaHref: '/book', tone: 'ink' },
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'text', label: 'Text', type: 'textarea' },
      ...linkPair('cta', 'Button'),
      { key: 'tone', label: 'Tone', type: 'select', options: [{ value: 'ink', label: 'Dark' }, { value: 'bone', label: 'Light' }] },
    ],
  },
  {
    type: 'faq', label: 'FAQ', glyph: '?', description: 'An accordion of questions and answers.',
    defaults: { heading: 'Frequently asked questions', items: [{ q: 'Question?', a: 'Answer.' }] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Questions', type: 'list', itemLabel: 'question', itemFields: [{ key: 'q', label: 'Question', type: 'text' }, { key: 'a', label: 'Answer', type: 'textarea' }] },
    ],
  },
  {
    type: 'gallery', label: 'Gallery', glyph: '▥', description: 'A grid of images.',
    defaults: { heading: '', columns: '3', items: [] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'columns', label: 'Columns', type: 'select', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }] },
      { key: 'items', label: 'Images', type: 'list', itemLabel: 'image', itemFields: [{ key: 'url', label: 'Image', type: 'image' }, { key: 'caption', label: 'Caption', type: 'text' }] },
    ],
  },
  {
    type: 'quote', label: 'Quote', glyph: '“', description: 'A large pull quote or testimonial.',
    defaults: { quote: '', author: '', role: '' },
    fields: [
      { key: 'quote', label: 'Quote', type: 'textarea' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'role', label: 'Role / detail', type: 'text' },
    ],
  },
  {
    type: 'marquee', label: 'Marquee', glyph: '➞', description: 'A scrolling ribbon of words or phrases.',
    defaults: { items: ['Innovation', 'Artistry', 'Care'] },
    fields: [
      { key: 'items', label: 'Phrases', type: 'list', itemLabel: 'phrase', itemFields: [{ key: 'value', label: 'Phrase', type: 'text' }] },
    ],
  },
  {
    type: 'twoColumn', label: 'Two columns', glyph: '◫', description: 'Two columns of text side by side.',
    defaults: { heading: '', left: '', right: '' },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'left', label: 'Left column', type: 'textarea', help: 'Separate paragraphs with a blank line.' },
      { key: 'right', label: 'Right column', type: 'textarea' },
    ],
  },
  {
    type: 'steps', label: 'Steps / timeline', glyph: '◷', description: 'Numbered steps or a process timeline.',
    defaults: { eyebrow: '', heading: 'How it works', items: [{ title: 'Step', text: '' }] },
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Steps', type: 'list', itemLabel: 'step', itemFields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'text', label: 'Text', type: 'textarea' }] },
    ],
  },
  {
    type: 'pricingTable', label: 'Pricing table', glyph: '£', description: 'A list of named prices.',
    defaults: { heading: '', items: [{ name: 'Treatment', price: '£0', note: '' }] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Rows', type: 'list', itemLabel: 'row', itemFields: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'price', label: 'Price', type: 'text' }, { key: 'note', label: 'Note', type: 'text' }] },
    ],
  },
  {
    type: 'logos', label: 'Logos / partners', glyph: '⬢', description: 'A row of partner logos or names.',
    defaults: { heading: '', items: [{ label: '', image: '' }] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Logos', type: 'list', itemLabel: 'logo', itemFields: [{ key: 'image', label: 'Logo image', type: 'image' }, { key: 'label', label: 'Name (fallback / alt)', type: 'text' }] },
    ],
  },
  {
    type: 'video', label: 'Video', glyph: '▷', description: 'An embedded YouTube or Vimeo video.',
    defaults: { url: '', caption: '' },
    fields: [
      { key: 'url', label: 'Video URL', type: 'text', placeholder: 'https://youtube.com/watch?v=…' },
      { key: 'caption', label: 'Caption', type: 'text' },
    ],
  },
  {
    type: 'contactCards', label: 'Info cards', glyph: '▣', description: 'A grid of small cards with an optional link.',
    defaults: { heading: '', columns: '3', items: [{ title: 'Title', text: '', linkLabel: '', linkHref: '' }] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'columns', label: 'Columns', type: 'select', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }] },
      { key: 'items', label: 'Cards', type: 'list', itemLabel: 'card', itemFields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'text', label: 'Text', type: 'textarea' }, { key: 'linkLabel', label: 'Link text', type: 'text' }, { key: 'linkHref', label: 'Link URL', type: 'link' }] },
    ],
  },
  {
    type: 'tags', label: 'Tag list', glyph: '⬡', description: 'A heading with a wrap of pill-style tags.',
    defaults: { eyebrow: '', heading: '', items: [{ label: 'Tag' }] },
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Tags', type: 'list', itemLabel: 'tag', itemFields: [{ key: 'label', label: 'Tag', type: 'text' }] },
    ],
  },
  // ── Dynamic / embed sections (pull live data or interactive components) ──
  {
    type: 'contactInfo', label: 'Contact details', glyph: '✆', description: 'Address, phone, email and opening hours — pulled live from Site settings.',
    defaults: { heading: 'Visit us', showHours: true, showBooking: true },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'showHours', label: 'Show opening hours', type: 'toggle' },
      { key: 'showBooking', label: 'Show booking buttons', type: 'toggle' },
    ],
  },
  {
    type: 'map', label: 'Map', glyph: '⌖', description: 'The clinic location map (from Site settings).',
    defaults: { height: 'md' },
    fields: [{ key: 'height', label: 'Height', type: 'select', options: [{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }] }],
  },
  {
    type: 'enquiryForm', label: 'Enquiry form', glyph: '✎', description: 'The contact enquiry form.',
    defaults: { eyebrow: 'Send an enquiry', heading: 'Tell us what you’re looking for.', intro: '' },
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'intro', label: 'Intro', type: 'textarea' },
    ],
  },
];

export const sectionDef = (type: string) => SECTION_DEFS.find((d) => d.type === type);
export const newSection = (type: string): Section => ({ id: uid(), type, data: JSON.parse(JSON.stringify(sectionDef(type)?.defaults ?? {})) });
export const cloneSection = (s: Section): Section => ({ id: uid(), type: s.type, hidden: s.hidden, data: JSON.parse(JSON.stringify(s.data ?? {})) });

/** Coerce unknown JSON (Prisma) into a trusted Section[]. */
export function asSections(value: unknown): Section[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Section => !!s && typeof s === 'object' && typeof (s as Section).type === 'string')
    .map((s) => ({ id: s.id || uid(), type: s.type, data: (s.data && typeof s.data === 'object') ? s.data : {}, hidden: !!s.hidden }));
}
