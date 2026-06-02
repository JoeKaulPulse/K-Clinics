// Auto-load secrets from scripts/migrate-wp/.env (or repo .env files) so the
// individual importers work when run standalone, not only via import-all.
// (When run via import-all, those vars are already set — we never override.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
function load(file) {
  if (!fs.existsSync(file)) return false;
  for (let line of fs.readFileSync(file, 'utf8').split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && !(k in process.env)) process.env[k] = v;
  }
  return true;
}
for (const f of [path.join(here, '.env'), path.join(repoRoot, '.env.production.local'), path.join(repoRoot, '.env.production'), path.join(repoRoot, '.env.local'), path.join(repoRoot, '.env')]) {
  if (load(f)) break;
}
