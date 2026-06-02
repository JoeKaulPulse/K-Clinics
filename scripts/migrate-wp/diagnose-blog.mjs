// Read-only: is there a blog (post_type=post) in the old WordPress dump worth
// migrating? Lists published post titles + counts. Titles aren't personal data.
//   node scripts/migrate-wp/diagnose-blog.mjs scripts/migrate-wp/data/full-dump.sql
import { streamDump, parseDate } from './lib-dump.mjs';

const file = process.argv[2] || 'scripts/migrate-wp/data/full-dump.sql';
const byType = new Map();           // post_type -> count
const posts = [];                   // published blog posts

await streamDump(file, {
  wantRows: (t) => /(^|_)posts$/i.test(t),
  onRows: (t, rows) => {
    for (const r of rows) {
      const type = r.post_type || '?';
      byType.set(type, (byType.get(type) || 0) + 1);
      if (type === 'post' && r.post_status === 'publish') {
        posts.push({ title: (r.post_title || '').trim(), slug: r.post_name, date: parseDate(r.post_date), len: (r.post_content || '').length });
      }
    }
  },
});

const num = (n) => n.toLocaleString('en-GB');
console.log('\n=== WordPress content inventory ===');
console.log('  post_type breakdown:');
for (const [t, c] of [...byType.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(c).padStart(5)}  ${t}`);
console.log(`\n  Published blog posts (post_type=post): ${num(posts.length)}`);
if (posts.length) {
  console.log('  (most recent first)');
  for (const p of posts.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)).slice(0, 30)) {
    console.log(`    ${p.date ? p.date.toISOString().slice(0, 10) : '----------'}  ${String(p.len).padStart(6)} chars  ${p.title.slice(0, 70)}`);
  }
}
console.log('');
