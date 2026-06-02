// Step 4: import the old WordPress blog (post_type=post, published) into the
// native Post table so the Journal is fully admin-managed — no WordPress needed.
//
//   Dry run:   node scripts/migrate-wp/migrate-blog.mjs --file data/full-dump.sql --dry-run
//   Commit:    DATABASE_URL=... node scripts/migrate-wp/migrate-blog.mjs --file data/full-dump.sql --commit
//
// wp_posts → Post. Upserts by slug (post_name), so it is safe to re-run: an
// existing post is updated in place, never duplicated. Imported rows are tagged
// source='wordpress' and published with their original post_date. Revisions,
// auto-drafts, pages and trashed posts are ignored.

import './lib-env.mjs';
import { streamDump, parseDate } from './lib-dump.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const file = opt('--file') || args.find((a) => a.endsWith('.sql'));
const commit = args.includes('--commit');
if (!file) { console.error('Provide --file <dump.sql>'); process.exit(1); }
const num = (n) => n.toLocaleString('en-GB');

const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);

// Decode the handful of HTML entities WordPress stores in titles/excerpts.
const ENT = { '&amp;': '&', '&#038;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#8217;': '’', '&#8216;': '‘', '&#8220;': '“', '&#8221;': '”', '&#8211;': '–', '&#8212;': '—', '&#8230;': '…', '&nbsp;': ' ', '&#039;': "'", '&#39;': "'" };
const decode = (s) => String(s || '').replace(/&#?\w+;/g, (m) => ENT[m] ?? m);

// WordPress classic content is plain text with blank-line paragraph breaks
// (wpautop runs at render time). Reproduce a lightweight version so imported
// posts read correctly through the journal-prose styles.
function toHtml(raw) {
  let s = String(raw || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');               // strip Gutenberg block comments
  s = s.replace(/\[[^\]]*\]/g, '');                     // strip shortcodes ([gallery], [caption]…)
  s = s.replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  const hasBlocks = /<\s*(p|h[1-6]|ul|ol|div|figure|blockquote|table)[\s>]/i.test(s);
  if (hasBlocks) return s;                              // already block-level HTML — keep as-is
  return s.split(/\n{2,}/).map((para) => {
    const t = para.trim();
    if (!t) return '';
    return `<p>${t.replace(/\n/g, '<br />')}</p>`;
  }).filter(Boolean).join('\n');
}

const stripTags = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const readMins = (html) => Math.max(1, Math.min(60, Math.round(stripTags(html).split(' ').filter(Boolean).length / 200)));
const excerptOf = (html, n = 200) => { const t = decode(stripTags(html)); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t; };

// Map a post to one of the journal categories from its words.
const CAT_RULES = [
  ['Dentistry', /\b(dental|dentist|teeth|tooth|smile|invisalign|whitening|veneer|implant|orthodont|hygien|gum|braces)\b/i],
  ['Injectables', /\b(botox|filler|injectable|anti-?wrinkle|lip|profhilo|dermal|toxin|aesthetic injection)\b/i],
  ['Laser', /\b(laser|ipl|hair removal|tattoo removal|pigment|vascular|resurfacing)\b/i],
  ['Skin', /\b(skin|facial|hydra|peel|acne|dermaplaning|microneedl|glow|collagen|complexion|rosacea)\b/i],
];
const categorise = (text) => { for (const [cat, re] of CAT_RULES) if (re.test(text)) return cat; return 'Wellbeing'; };

const posts = new Map();   // slug -> record (last one wins; dump is chronological)
await streamDump(file, {
  wantRows: (t) => /(^|_)posts$/i.test(t),
  onRows: (t, rows) => {
    for (const r of rows) {
      if (r.post_type !== 'post' || r.post_status !== 'publish') continue;
      const title = decode((r.post_title || '').trim());
      if (!title) continue;
      const slug = slugify(r.post_name || title);
      if (!slug) continue;
      const html = toHtml(r.post_content);
      const text = `${title} ${stripTags(html)}`;
      const excerpt = r.post_excerpt && stripTags(r.post_excerpt) ? excerptOf(r.post_excerpt) : excerptOf(html);
      posts.set(slug, {
        slug, title, html, excerpt,
        category: categorise(text),
        readMinutes: readMins(html),
        publishedAt: parseDate(r.post_date) || parseDate(r.post_date_gmt) || new Date(),
      });
    }
  },
});

const list = [...posts.values()].sort((a, b) => +b.publishedAt - +a.publishedAt);
const byCat = list.reduce((m, p) => (m[p.category] = (m[p.category] || 0) + 1, m), {});
console.log('\n=== WordPress blog → Post table ===');
console.log(`Published posts found : ${num(list.length)}`);
console.log(`By category           : ${Object.entries(byCat).map(([c, n]) => `${c} ${n}`).join(', ')}`);
const empty = list.filter((p) => stripTags(p.html).length < 40).length;
if (empty) console.log(`(${num(empty)} have little/no body — imported anyway; edit in the admin if needed.)`);

if (!commit) {
  console.log('\nMost recent 10:');
  for (const p of list.slice(0, 10)) console.log(`  ${p.publishedAt.toISOString().slice(0, 10)}  [${p.category}] ${p.title.slice(0, 64)}`);
  console.log('\nDRY RUN — nothing written. Re-run with --commit (and DATABASE_URL) to import.\n');
  process.exit(0);
}

const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
let created = 0, updated = 0;
try {
  for (const p of list) {
    const before = await db.post.findUnique({ where: { slug: p.slug }, select: { id: true } });
    await db.post.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title, excerpt: p.excerpt, content: p.html, category: p.category,
        readMinutes: p.readMinutes, status: 'PUBLISHED', source: 'wordpress', publishedAt: p.publishedAt,
      },
      create: {
        slug: p.slug, title: p.title, excerpt: p.excerpt, content: p.html, category: p.category,
        readMinutes: p.readMinutes, status: 'PUBLISHED', source: 'wordpress', publishedAt: p.publishedAt,
      },
    });
    if (before) updated++; else created++;
  }
  console.log(`\n✓ Blog import: ${num(created)} created, ${num(updated)} updated. Live at /journal and editable under Admin → Journal.\n`);
} finally {
  await db.$disconnect();
}
