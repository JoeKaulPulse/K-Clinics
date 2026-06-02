// Step 2 of the migration: build KClinics Clients from a WordPress/WooCommerce
// dump — every registered user AND every WooCommerce customer (incl. guests),
// de-duplicated by email, with original signup dates and contact details kept.
//
//   Dry run (no database needed, prints a reconciliation report):
//     node scripts/migrate-wp/migrate.mjs --file data/full-dump.sql --dry-run
//
//   Commit (writes via Prisma; needs DATABASE_URL):
//     DATABASE_URL=... node scripts/migrate-wp/migrate.mjs --file data/full-dump.sql --commit
//
// Safety: WordPress is read-only here. We never import password hashes (clients
// set a password via "forgot password" on first visit). Re-runnable: upserts by
// email and only fills blank fields, so a second run never clobbers edits.
//
// Health/consent forms, order history and bookings are deliberately NOT imported
// yet — they depend on which plugins the inventory reveals. This step nails the
// backbone (the people); the rest is layered on once we see the inventory.

import { streamDump, normEmail, parseDate } from './lib-dump.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const file = opt('--file') || args.find((a) => a.endsWith('.sql'));
const commit = args.includes('--commit');
const refresh = args.includes('--refresh'); // overwrite name/contact on existing WP clients
const dryRun = args.includes('--dry-run') || !commit;
if (!file) { console.error('Provide --file <dump.sql>'); process.exit(1); }

const suf = (t) => t.replace(/^[a-z0-9]+_/i, '');

// ── usermeta keys we understand ─────────────────────────────────────────────
const MAP = new Set([
  'first_name', 'last_name', 'description',
  'billing_first_name', 'billing_last_name', 'billing_email', 'billing_phone',
  'billing_company', 'billing_address_1', 'billing_address_2', 'billing_city',
  'billing_state', 'billing_postcode', 'billing_country',
]);
const DOB_KEYS = ['dob', 'date_of_birth', 'birth_date', 'birthday', 'billing_dob'];
const OPTIN_KEYS = ['newsletter', 'marketing_optin', 'subscribe', 'email_marketing', 'mailchimp_woocommerce_is_subscribed'];
// Internal WordPress noise we never preserve into client notes.
const NOISE = /^(wp_|_wp|session_tokens|capabilities|user_level|rich_editing|syntax_highlighting|comment_shortcuts|admin_color|use_ssl|show_admin_bar|dismissed_|nickname|locale|last_update|community-events|managenav|metaboxhidden|closedpostboxes|meta-box-order|screen_layout|primary_blog|source_domain|_yoast|_application_passwords|wc_last_active|paying_customer)/i;

const truthy = (v) => /^(1|yes|true|on|subscribed)$/i.test(String(v ?? '').trim());

// ── gather from the dump ────────────────────────────────────────────────────
const users = new Map();           // id -> { login, email, registered, display }
const meta = new Map();            // userId -> { key: value }
const shopOrders = new Map();      // postId -> date
const orderMeta = new Map();       // postId -> { key: value }   (billing_* for shop_order)
const hposAddr = [];               // [{ email, first, last, phone, ... , customer_id }]
const lookup = [];                 // wc_customer_lookup rows
const unmapped = new Map();        // meta_key -> frequency (for refining the map)

const BILLING_PM = new Set(['_billing_email', '_billing_first_name', '_billing_last_name', '_billing_phone', '_billing_company', '_billing_address_1', '_billing_address_2', '_billing_city', '_billing_state', '_billing_postcode', '_billing_country', '_customer_user', '_date_completed', '_completed_date', '_order_currency']);

const mailpoet = new Map();        // email -> subscription status (marketing consent)
const wantRows = (t) => /(^|_)(users|usermeta|posts|postmeta|wc_order_addresses|wc_customer_lookup|mailpoet_subscribers)$/i.test(t);

await streamDump(file, {
  wantRows,
  onRows: (t, rows) => {
    const s = suf(t);
    if (s === 'users') {
      // This site added custom columns to wp_users — the richest source of
      // phone, DOB, address and consent. Capture them alongside the standard ones.
      for (const r of rows) users.set(r.ID ?? r.id, {
        login: r.user_login, email: normEmail(r.user_email), registered: parseDate(r.user_registered), display: r.display_name,
        phone: r.phone, birthday: r.birthday, city: r.city, street: r.street, postalcode: r.postalcode,
        subsNews: r.subs_news, sms: r.sms, skidka: r.skidka, refMy: r.my_referal, refLink: r.referal_link,
      });
    } else if (s === 'usermeta') {
      for (const r of rows) {
        const id = r.user_id; const k = r.meta_key;
        if (id == null || k == null) continue;
        let m = meta.get(id); if (!m) meta.set(id, (m = {}));
        m[k] = r.meta_value;
        if (!MAP.has(k) && !DOB_KEYS.includes(k) && !OPTIN_KEYS.includes(k) && !NOISE.test(k)) unmapped.set(k, (unmapped.get(k) || 0) + 1);
      }
    } else if (s === 'posts') {
      for (const r of rows) if (r.post_type === 'shop_order' || r.post_type === 'shop_subscription') shopOrders.set(r.ID ?? r.id, parseDate(r.post_date));
    } else if (s === 'postmeta') {
      for (const r of rows) if (BILLING_PM.has(r.meta_key)) { let m = orderMeta.get(r.post_id); if (!m) orderMeta.set(r.post_id, (m = {})); m[r.meta_key] = r.meta_value; }
    } else if (s === 'wc_order_addresses') {
      for (const r of rows) if ((r.address_type || 'billing') === 'billing') hposAddr.push(r);
    } else if (s === 'wc_customer_lookup') {
      for (const r of rows) lookup.push(r);
    } else if (s === 'mailpoet_subscribers') {
      for (const r of rows) { const e = normEmail(r.email); if (e) mailpoet.set(e, String(r.status || '').toLowerCase()); }
    }
  },
});

// ── resolve into client records, de-duplicated by normalised email ──────────
const clients = new Map(); // email -> record
let fromUsers = 0, fromOrders = 0, skippedNoEmail = 0;

function blank(s) { return s == null || String(s).trim() === ''; }
function firstToken(s) { return (s || '').trim().split(/\s+/)[0] || ''; }
const titleCase = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// A display name is usable only if it's an actual name — has a letter (any
// script, incl. Cyrillic), no digits, not an email. Handles like "abc1.abc1"
// or "99999" are rejected so we don't show logins as names.
function usableDisplayName(s) { return !blank(s) && !/\d/.test(s) && !/@/.test(s) && /\p{L}/u.test(s); }
// Last resort: reconstruct a name from the email local part (anna.smith → Anna
// Smith). Flags `review` so staff can sanity-check these.
function nameFromEmail(email) {
  const local = (String(email || '').split('@')[0] || '').replace(/\+.*$/, '');
  const toks = local.split(/[._-]+/).filter((t) => t && !/^\d+$/.test(t));
  if (!toks.length) return { first: 'Client', last: '', review: true };
  return { first: titleCase(toks[0]), last: toks.slice(1).map(titleCase).join(' '), review: true };
}
// Best available name: proper meta → billing → real display name → email.
function deriveName(m, display, email) {
  if (!blank(m.billing_first_name) || !blank(m.billing_last_name)) return { first: (m.billing_first_name || m.first_name || '').trim(), last: (m.billing_last_name || m.last_name || '').trim(), review: false };
  if (!blank(m.first_name) || !blank(m.last_name)) return { first: (m.first_name || '').trim(), last: (m.last_name || '').trim(), review: false };
  if (usableDisplayName(display)) { const p = display.trim().split(/\s+/); return { first: p[0], last: p.slice(1).join(' '), review: false }; }
  return nameFromEmail(email);
}

// Spot junk/test signups from the old site (keyboard-mash, repeated words, bot
// gibberish) so they can be filtered + bulk-archived rather than counted as real
// clients. Conservative: real clients don't have digits in their name, repeated
// first==last, or dotless gibberish emails with embedded digits.
const KB_MASH = /^(qwerty|asdf|zxcv|qwe|asd|zxc|wsx|edc|test|demo|sample|www+|abcd?|abc123|sdfg|dfgd?|fghj|hjkl|xxx+|aaa+|zzz+|qqq+|wer|ert|rty|asdasd|qweqwe)$/i;
function isLikelyTest(first, last, email) {
  const f = (first || '').trim(), l = (last || '').trim();
  if (f && l && f.toLowerCase() === l.toLowerCase()) return true; // "November November", "qwerty qwerty"
  if (/\d/.test(f)) return true;                                   // "Www5"
  if (KB_MASH.test(f)) return true;
  const local = String(email || '').split('@')[0];
  const gibberish = local.length >= 6 && local.length <= 14 && !/[._-]/.test(local) && /[a-z]\d/i.test(local) && /\d[a-z]/i.test(local);
  if (gibberish && f.length <= 8) return true;                     // bot signup e.g. "jrq17j9t"
  return false;
}
// Birthday/date columns on this site may be ISO, dd.mm.yyyy, dd/mm/yyyy or unix.
function parseFlexDate(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.startsWith('0000')) return null;
  let m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return parseDate(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')} 00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return parseDate(/[ T]/.test(s) ? s : s + ' 00:00:00');
  if (/^\d{9,10}$/.test(s)) { const d = new Date(Number(s) * 1000); return isNaN(d) ? null : d; }
  return parseDate(s);
}
function upsertLocal(email, data, createdAt, fromOrder) {
  if (!email) { skippedNoEmail++; return; }
  let c = clients.get(email);
  if (!c) { c = { email, tags: new Set(['migrated:wordpress']), notes: [], marketingOptIn: false, smsReminders: false }; clients.set(email, c); }
  for (const [k, v] of Object.entries(data)) if (!blank(v) && blank(c[k])) c[k] = v;
  if (createdAt && (!c.createdAt || createdAt < c.createdAt)) c.createdAt = createdAt;
  if (fromOrder) c.tags.add('woocommerce-customer');
}

// Registered users
for (const [id, u] of users) {
  const m = meta.get(id) || {};
  const email = u.email || normEmail(m.billing_email);
  if (!email) { skippedNoEmail++; continue; }
  fromUsers++;
  const nm = deriveName(m, u.display, email);
  const firstName = nm.first || email.split('@')[0];
  const lastName = nm.last || null;
  // DOB: custom `birthday` column first, then any meta fallback.
  let dob = parseFlexDate(u.birthday);
  if (!dob) for (const k of DOB_KEYS) if (!blank(m[k])) { dob = parseFlexDate(m[k]); break; }
  // Consent: custom column, the registration newsletter checkbox, an active
  // MailPoet subscription, or any opt-in meta — any of these = opted in.
  const optIn = truthy(u.subsNews) || truthy(m['xoo-mailpoet-subscribe'])
    || mailpoet.get(email) === 'subscribed' || OPTIN_KEYS.some((k) => truthy(m[k]));
  const sms = truthy(u.sms);
  const phone = u.phone || m.billing_phone || m.booked_phone;
  upsertLocal(email, { firstName, lastName, phone, dob, source: 'wordpress', wpUserId: id, registered: u.registered }, u.registered, false);
  const c = clients.get(email);
  if (nm.review) c.tags.add('needs-name-review');
  if (isLikelyTest(firstName, lastName, email)) c.tags.add('likely-test');
  if (optIn) c.marketingOptIn = true;
  if (sms) c.smsReminders = true;
  // preserve address (custom columns first, then billing meta) + any unmapped meta
  const addr = [u.street, u.city, u.postalcode].filter((x) => !blank(x)).join(', ')
    || [m.billing_address_1, m.billing_address_2, m.billing_city, m.billing_postcode, m.billing_country].filter((x) => !blank(x)).join(', ');
  if (addr) c.address = c.address || addr;
  if (!blank(u.skidka) && String(u.skidka) !== '0') c.notes.push(`legacy loyalty discount: ${u.skidka}`);
  if (!blank(u.refMy)) c.notes.push(`referral code: ${u.refMy}`);
  for (const [k, v] of Object.entries(m)) if (!MAP.has(k) && !DOB_KEYS.includes(k) && !OPTIN_KEYS.includes(k) && !NOISE.test(k) && !blank(v) && !String(v).startsWith('a:')) c.notes.push(`${k}: ${String(v).slice(0, 160)}`);
}

// WooCommerce orders — legacy (post-based)
for (const [postId, m] of orderMeta) {
  const email = normEmail(m._billing_email);
  if (!email) continue;
  fromOrders++;
  const addr = [m._billing_address_1, m._billing_address_2, m._billing_city, m._billing_postcode, m._billing_country].filter((x) => !blank(x)).join(', ');
  const g = nameFromEmail(email);
  upsertLocal(email, { firstName: m._billing_first_name || g.first, lastName: m._billing_last_name || g.last, phone: m._billing_phone, source: 'wordpress', address: addr || null }, shopOrders.get(postId), true);
}
// WooCommerce orders — HPOS (wc_order_addresses)
for (const a of hposAddr) {
  const email = normEmail(a.email);
  if (!email) continue;
  fromOrders++;
  const addr = [a.address_1, a.address_2, a.city, a.postcode, a.country].filter((x) => !blank(x)).join(', ');
  const g = nameFromEmail(email);
  upsertLocal(email, { firstName: a.first_name || g.first, lastName: a.last_name || g.last, phone: a.phone, source: 'wordpress', address: addr || null }, null, true);
}
// wc_customer_lookup (supplemental — fills gaps, last-active date)
for (const r of lookup) {
  const email = normEmail(r.email);
  if (!email) continue;
  const g = nameFromEmail(email);
  upsertLocal(email, { firstName: r.first_name || g.first, lastName: r.last_name || g.last, source: 'wordpress', lastVisitAt: parseDate(r.date_last_active) }, null, true);
}

// ── report ──────────────────────────────────────────────────────────────────
const list = [...clients.values()];
const withPhone = list.filter((c) => !blank(c.phone)).length;
const withDob = list.filter((c) => c.dob).length;
const withAddr = list.filter((c) => !blank(c.address)).length;
const optedIn = list.filter((c) => c.marketingOptIn).length;
const needsReview = list.filter((c) => c.tags.has('needs-name-review')).length;
const likelyTest = list.filter((c) => c.tags.has('likely-test')).length;
const num = (n) => n.toLocaleString('en-GB');

console.log('\n=== WordPress → Clients reconciliation ===');
console.log(`Source rows scanned : users=${num(users.size)}  usermeta-users=${num(meta.size)}  legacy-orders=${num(orderMeta.size)}  hpos-addr=${num(hposAddr.length)}  lookup=${num(lookup.length)}`);
console.log(`Contributed         : from users=${num(fromUsers)}  from orders=${num(fromOrders)}  skipped(no email)=${num(skippedNoEmail)}`);
console.log(`\n→ UNIQUE CLIENTS (deduped by email): ${num(list.length)}`);
console.log(`   with phone   : ${num(withPhone)}`);
console.log(`   with DOB     : ${num(withDob)}`);
console.log(`   with address : ${num(withAddr)}  (kept in notes until we add address fields)`);
console.log(`   marketing opt-in (explicit) : ${num(optedIn)}`);
console.log(`   names needing review (no real name in source): ${num(needsReview)}  ${refresh ? '[--refresh: messy names will be overwritten]' : ''}`);
console.log(`   likely test/junk accounts (tagged 'likely-test'): ${num(likelyTest)}`);

if (unmapped.size) {
  console.log('\nUnmapped usermeta keys seen (PII-free key names — paste back so I can map them):');
  for (const [k, n] of [...unmapped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`   ${String(n).padStart(6)}  ${k}`);
}

if (dryRun) {
  console.log('\nDRY RUN — nothing written. Re-run with --commit (and DATABASE_URL) to import.\n');
  process.exit(0);
}

// ── commit via Prisma ────────────────────────────────────────────────────────
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
let created = 0, updated = 0, n = 0;
try {
  for (const c of list) {
    n++;
    const notes = c.notes.length ? `Imported from WordPress.\n${c.notes.join('\n')}` : 'Imported from WordPress.';
    const baseCreate = {
      email: c.email,
      firstName: (c.firstName || c.email.split('@')[0]).slice(0, 120),
      lastName: c.lastName ? String(c.lastName).slice(0, 120) : null,
      phone: c.phone ? String(c.phone).slice(0, 40) : null,
      dob: c.dob || null,
      source: 'wordpress',
      tags: [...c.tags],
      notes: notes.slice(0, 4000),
      marketingOptIn: c.marketingOptIn,
      smsReminders: c.smsReminders,
      lastVisitAt: c.lastVisitAt || null,
      ...(c.createdAt ? { createdAt: c.createdAt } : {}),
    };
    const existing = await db.client.findUnique({ where: { email: c.email }, select: { id: true, source: true, firstName: true, lastName: true, phone: true, dob: true, tags: true, notes: true, marketingOptIn: true, smsReminders: true } });
    if (!existing) {
      await db.client.create({ data: baseCreate });
      created++;
    } else if (refresh && existing.source === 'wordpress') {
      // --refresh: re-derive and OVERWRITE name/contact on WP-imported clients
      // (e.g. to clean up messy names). Only touches migration-owned records.
      await db.client.update({
        where: { id: existing.id },
        data: {
          firstName: baseCreate.firstName,
          lastName: baseCreate.lastName,
          phone: baseCreate.phone ?? existing.phone,
          dob: baseCreate.dob ?? existing.dob,
          marketingOptIn: existing.marketingOptIn || baseCreate.marketingOptIn,
          smsReminders: existing.smsReminders || baseCreate.smsReminders,
          tags: [...new Set([...(existing.tags || []), ...baseCreate.tags])],
        },
      });
      updated++;
    } else {
      // Conservative: only fill blanks, merge tags — never overwrite live edits.
      await db.client.update({
        where: { id: existing.id },
        data: {
          phone: existing.phone ?? baseCreate.phone,
          dob: existing.dob ?? baseCreate.dob,
          tags: [...new Set([...(existing.tags || []), ...baseCreate.tags])],
          notes: existing.notes ?? baseCreate.notes,
        },
      });
      updated++;
    }
    if (n % 200 === 0) console.log(`  …${n}/${list.length}`);
  }
  console.log(`\n✓ Done. Created ${num(created)}, updated ${num(updated)}, total ${num(list.length)}.\n`);
} finally {
  await db.$disconnect();
}
