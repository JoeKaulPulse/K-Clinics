// Read-only: where can each sign_table consent reach a client from?
// PII-free output (ids + counts only). node scripts/migrate-wp/diagnose-sign-link.mjs <dump.sql>
import { streamDump, normEmail } from './lib-dump.mjs';
const file = process.argv[2] || 'scripts/migrate-wp/data/127_0_0_1.sql';
const userIds = new Set(); const userEmail = new Map();
const sign = []; const grafikByUser = new Map();
await streamDump(file, {
  wantRows: (t) => /(^|_)users$/i.test(t) || t === 'sign_table' || t === 'grafik' || t === 'grafik_dent',
  onRows: (t, rows) => {
    if (/(^|_)users$/i.test(t)) for (const r of rows) { userIds.add(Number(r.ID ?? r.id)); if (normEmail(r.user_email)) userEmail.set(Number(r.ID ?? r.id), true); }
    else if (t === 'sign_table') for (const r of rows) sign.push({ id: r.id, idUser: Number(r.id_user), hasPodp: !!r.podp, podpHead: String(r.podp || '').slice(0, 12) });
    else for (const r of rows) { const k = Number(r.id_user); const a = grafikByUser.get(k) || { n: 0, named: 0 }; a.n++; if (String(r.fname || '').trim()) a.named++; grafikByUser.set(k, a); }
  },
});
const zero = sign.filter((s) => s.idUser === 0);
const linked = sign.filter((s) => s.idUser !== 0 && userIds.has(s.idUser));
const orphan = sign.filter((s) => s.idUser !== 0 && !userIds.has(s.idUser));
console.log(`sign_table rows=${sign.length}  id_user=0 (guest/kiosk)=${zero.length}  linked to wp_users=${linked.length}  orphaned id_user=${orphan.length}`);
console.log(`orphan id_user values: ${[...new Set(orphan.map((s) => s.idUser))].sort((a, b) => a - b).join(', ')}`);
console.log(`  …of those, with grafik bookings (named): ${orphan.filter((s) => grafikByUser.get(s.idUser)?.named).length}`);
console.log(`max wp_users.ID=${Math.max(...userIds)}  wp_users count=${userIds.size}`);
console.log(`podp present=${sign.filter((s) => s.hasPodp).length}; first bytes sample: ${[...new Set(sign.map((s) => s.podpHead.slice(0, 2)))].join(' | ')}`);
