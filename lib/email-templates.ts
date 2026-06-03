import type { EmailBlock } from '@/lib/email-builder';

// Built-in starting points for new marketing emails. These ship with the app
// (no DB row) and appear alongside any templates the clinic saves. Blocks use
// merge tags so the starter is already personalised.
export type StarterTemplate = { key: string; name: string; subject: string; preheader?: string; blocks: EmailBlock[] };

const BOOK = 'https://kclinics.co.uk/book';

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: 'blank',
    name: 'Blank',
    subject: '',
    blocks: [{ type: 'heading', text: 'Your headline', align: 'left' }, { type: 'paragraph', text: 'Write your message here…', align: 'left' }],
  },
  {
    key: 'newsletter',
    name: 'Monthly newsletter',
    subject: 'This month at KClinics ✨',
    preheader: 'New treatments, seasonal offers and a little glow.',
    blocks: [
      { type: 'subheading', text: 'This month', align: 'left' },
      { type: 'heading', text: 'Hello {{first_name}}, here’s what’s new', align: 'left' },
      { type: 'paragraph', text: 'A short, warm intro about what’s happening at the clinic this month.', align: 'left' },
      { type: 'list', items: ['A new treatment we’re excited about', 'A seasonal skincare tip', 'A member-only offer'] },
      { type: 'button', label: 'Book an appointment', href: BOOK, align: 'left' },
      { type: 'divider' },
      { type: 'paragraph', text: 'With care,\nThe KClinics team', align: 'left' },
    ],
  },
  {
    key: 'promotion',
    name: 'Seasonal offer',
    subject: 'A little treat for you, {{first_name}}',
    preheader: 'Our seasonal offer is here — for a limited time.',
    blocks: [
      { type: 'heading', text: 'A seasonal offer, just for you', align: 'center' },
      { type: 'paragraph', text: 'Tell {{first_name}} about the offer — what it is, why it’s special, and when it ends.', align: 'center' },
      { type: 'spacer', size: 'sm' },
      { type: 'button', label: 'Claim your offer', href: BOOK, align: 'center' },
      { type: 'spacer', size: 'sm' },
      { type: 'paragraph', text: 'Terms apply. Offer ends soon.', align: 'center' },
    ],
  },
  {
    key: 'reengage',
    name: 'We miss you',
    subject: 'We’d love to see you again, {{first_name}}',
    preheader: 'It’s been a while — here’s a reason to come back.',
    blocks: [
      { type: 'heading', text: 'It’s been a little while', align: 'left' },
      { type: 'paragraph', text: 'Hi {{first_name}}, we’d love to welcome you back. Here’s what’s new since your last visit, and a gentle nudge to book in.', align: 'left' },
      { type: 'button', label: 'Rebook now', href: BOOK, align: 'left' },
    ],
  },
];
