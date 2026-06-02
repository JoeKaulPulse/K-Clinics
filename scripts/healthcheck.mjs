// Final-pass health check — pings the live /api/health and prints a green/red
// checklist of the deployment + integrations.
//
//   node scripts/healthcheck.mjs                       # checks NEXT_PUBLIC_SITE_URL (or k-clinics.vercel.app)
//   node scripts/healthcheck.mjs https://your-domain   # explicit site
//
// Set CRON_SECRET (env, or scripts/migrate-wp/.env) to unlock the integration
// list; without it you still get app/DB/secret checks. No secrets are printed.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function envVal(file, key) {
  try {
    for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
      const t = l.trim(); if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('='); if (i < 0) continue;
      if (t.slice(0, i).trim().replace(/^export\s+/, '') === key) {
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        return v;
      }
    }
  } catch { /* ignore */ }
  return null;
}
const fromEnvFiles = (key) => process.env[key] || envVal(path.join(root, 'scripts/migrate-wp/.env'), key) || envVal(path.join(root, '.env'), key);

const arg = process.argv.slice(2).find((a) => a.startsWith('http'));
const site = (arg || fromEnvFiles('NEXT_PUBLIC_SITE_URL') || 'https://k-clinics.vercel.app').replace(/\/$/, '');
const secret = fromEnvFiles('CRON_SECRET');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';
const mark = (s) => (s === true ? `${G}✓${X}` : s === 'warn' ? `${Y}●${X}` : `${R}✗${X}`);
const line = (s, label, extra = '') => console.log(`  ${mark(s)} ${label}${extra ? `  ${D}${extra}${X}` : ''}`);
let red = 0;
const need = (ok, label, extra) => { if (ok !== true) red++; line(ok, label, extra); };

console.log(`\n  KClinics health check → ${site}\n`);

let res, h;
try {
  const u = `${site}/api/health${secret ? `?secret=${encodeURIComponent(secret)}` : ''}`;
  res = await fetch(u, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
  h = await res.json();
} catch (e) {
  line(false, 'Site reachable', e.message);
  console.log(`\n  ${R}Could not reach the site — is the URL right and deployed?${X}\n`);
  process.exit(1);
}

need(res.ok && h.ok === true, 'App + database up', `HTTP ${res.status}${h.commit ? ` · build ${h.commit}` : ''}`);
if (h.database) need(h.database === 'connected', 'Database connection', `${h.clientCount ?? '?'} clients`);
if ('schemaInSync' in h) {
  const bad = Object.entries(h.schema || {}).filter(([, v]) => v !== 'ok').map(([k]) => k);
  need(h.schemaInSync === true, 'Database schema in sync', bad.length ? `behind: ${bad.join(', ')}` : '');
}
if (h.secrets) {
  need(h.secrets.jwtSelfTest === 'ok', 'Login secrets (JWT round-trip)', h.secrets.jwtSelfTest === 'ok' ? '' : String(h.secrets.jwtSelfTest));
  need(h.secrets.encryptionSelfTest === 'ok', 'Health-data encryption round-trip', h.secrets.encryptionSelfTest === 'ok' ? '' : String(h.secrets.encryptionSelfTest));
}

if (Array.isArray(h.integrations)) {
  console.log(`\n  Integrations`);
  for (const i of h.integrations) {
    const s = i.status === 'connected' ? true : i.status === 'partial' ? 'warn' : 'warn';
    line(s, i.name, i.missing?.length ? `missing: ${i.missing.join(', ')}` : i.status);
  }
} else {
  console.log(`\n  ${Y}●${X} ${D}Integration detail locked — set CRON_SECRET (env or scripts/migrate-wp/.env) to unlock it.${X}`);
}

console.log(`\n  ${red === 0 ? `${G}All core checks passed.${X}` : `${R}${red} core check(s) need attention.${X}`}\n`);
process.exit(red === 0 ? 0 : 1);
