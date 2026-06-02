// Read-only: how does grafik.id_usluga map to a service NAME? Checks both the
// uslugi and price tables. Treatment names aren't personal data, so the sample
// output is safe to share. node scripts/migrate-wp/diagnose-services.mjs <dump.sql>
import { streamDump } from './lib-dump.mjs';
const file = process.argv[2] || 'scripts/migrate-wp/data/full-dump.sql';
const uslugi = new Map();   // id -> {name,name1}
const price = new Map();    // id -> {name, id_uslugi}
const grafikIds = new Map();// id_usluga -> count
await streamDump(file, {
  wantRows: (t) => ['uslugi', 'price', 'grafik', 'grafik_dent'].includes(t),
  onRows: (t, rows) => {
    if (t === 'uslugi') for (const r of rows) uslugi.set(String(r.id), { name: r.name, name1: r.name1 });
    else if (t === 'price') for (const r of rows) price.set(String(r.id), { name: r.name, id_uslugi: String(r.id_uslugi) });
    else for (const r of rows) grafikIds.set(String(r.id_usluga), (grafikIds.get(String(r.id_usluga)) || 0) + 1);
  },
});
const ids = [...grafikIds.keys()];
const inUslugi = ids.filter((i) => uslugi.has(i)).length;
const inPrice = ids.filter((i) => price.has(i)).length;
console.log(`\n=== grafik.id_usluga resolution (${ids.length} distinct service ids used) ===`);
console.log(`  match uslugi.id : ${inUslugi}/${ids.length}   (uslugi has ${uslugi.size} rows)`);
console.log(`  match price.id  : ${inPrice}/${ids.length}   (price has ${price.size} rows)`);
console.log(`\n  sample resolution (top by usage):`);
for (const [id, c] of [...grafikIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  const u = uslugi.get(id), p = price.get(id);
  const viaPrice = p ? (p.name || uslugi.get(p.id_uslugi)?.name1 || uslugi.get(p.id_uslugi)?.name) : null;
  console.log(`   id ${id.padStart(4)} ×${String(c).padStart(3)}  uslugi='${(u?.name1 || u?.name || '∅')}'  price.name='${(p?.name || '∅')}'  via-price→uslugi='${viaPrice || '∅'}'`);
}
console.log('');
