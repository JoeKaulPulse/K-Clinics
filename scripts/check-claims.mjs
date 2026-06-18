// Claims-governance check (BLD-226, item 6). Scans code-driven marketing copy
// for wording that carries UK advertising risk (CAP/ASA + MHRA for aesthetics):
// prescription-only medicine (POM) brand names, absolute guarantees, and
// unsubstantiated health claims. Reports file:line with a suggested rewrite.
//
//   node scripts/check-claims.mjs            # report (exit 1 if HIGH found)
//   node scripts/check-claims.mjs --file-task  # also open a P0 build-board task
//
// Routing (item 6): code-driven copy (lib/treatments*.ts, lib/team.ts, marketing
// pages) → this check + a P0 build-board task for Claude to reword. DB-driven copy
// (edited in Admin → Website) is out of scope here — flag it to the admin to edit.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Public-facing MARKETING copy only. Internal/educational/AI/transactional files
// (academy course material, build backlog, the kiosk AI prompt, email templates)
// legitimately name products and are out of scope for the public-advertising gate.
const TARGET_DIRS = ['app/(marketing)', 'components/treatment', 'components/marketing'];
const TARGET_FILES = ['lib/treatments.ts', 'lib/treatments-imported.ts', 'lib/team.ts', 'lib/articles.ts'];

// severity: HIGH = likely breach, fix now · MED = review/substantiate.
const RULES = [
  { re: /\b(botox|juv[eé]derm|dysport|bocouture|azzalure|restylane|profhilo)\b/i, sev: 'HIGH', why: 'Names a prescription-only medicine (POM) — CAP 12.12 prohibits advertising POMs to the public.', fix: 'Use a generic description e.g. "anti-wrinkle injections".' },
  { re: /\bbotulinum\b/i, sev: 'HIGH', why: 'Names the POM substance.', fix: 'Refer to "anti-wrinkle / wrinkle-relaxing injections".' },
  { re: /\bpainless\b/i, sev: 'HIGH', why: 'Absolute comfort claim — indefensible (pain varies).', fix: '"comfortable" / "designed to minimise discomfort".' },
  { re: /\bscar[-\s]?free\b/i, sev: 'HIGH', why: 'Absolute outcome claim.', fix: '"low-scarring" / "minimal scarring".' },
  { re: /\b(100%\s*safe|completely safe|totally safe|risk[-\s]?free)\b/i, sev: 'HIGH', why: 'Absolute safety claim.', fix: '"carefully performed by trained clinicians".' },
  { re: /\bguarantee(d|ing|s)?\b/i, sev: 'MED', why: 'Outcome guarantee — hard to substantiate.', fix: '"designed to" / "aims to" / "supports".' },
  { re: /\b(detox(?:ify|ifies|ification)?|toxins)\b/i, sev: 'MED', why: 'Unsubstantiated "detox/toxins" physiology claim.', fix: '"supports drainage" / remove.' },
  { re: /\b(no side[-\s]?effects|zero downtime|permanent results)\b/i, sev: 'MED', why: 'Absolute / over-claim.', fix: 'Qualify: "little to no downtime", "long-lasting".' },
  { re: /\bclinically proven\b/i, sev: 'MED', why: '"Clinically proven" needs a cited study.', fix: 'Link the evidence or soften to "clinically informed".' },
  { re: /\b(miracle|cure|eliminates?\b)/i, sev: 'MED', why: 'Cure/miracle language.', fix: '"helps reduce / improve".' },
];

// Internal refs that aren't public ad copy: slug/key definitions and URL paths.
const IGNORE = [/slug:\s*["']botox/i, /["']botox["']\s*:/i, /href:\s*["'][^"']*\/botox/i, /\/botox\b/i];

function walk(dir, acc) {
  let entries; try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(p)) acc.push(p);
  }
  return acc;
}

const files = new Set(TARGET_FILES);
for (const d of TARGET_DIRS) walk(d, []).forEach((f) => files.add(f));

const findings = [];
for (const f of files) {
  let text; try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    if (IGNORE.some((re) => re.test(line))) return;
    for (const r of RULES) {
      const m = line.match(r.re);
      if (m) findings.push({ file: f, line: i + 1, sev: r.sev, term: m[0], why: r.why, fix: r.fix });
    }
  });
}

const high = findings.filter((f) => f.sev === 'HIGH');
const med = findings.filter((f) => f.sev === 'MED');
console.log(`Claims scan: ${findings.length} flag(s) — ${high.length} HIGH, ${med.length} MED\n`);
for (const f of [...high, ...med]) {
  console.log(`[${f.sev}] ${f.file}:${f.line}  "${f.term}"\n   ${f.why}\n   → ${f.fix}`);
}

if (process.argv.includes('--file-task') && findings.length) {
  const base = process.env.BASE_URL || 'https://kclinics.co.uk';
  const token = process.env.BOARD_QUEUE_TOKEN;
  if (!token) { console.error('\nNo BOARD_QUEUE_TOKEN — cannot file a build-board task.'); }
  else {
    const detail = [...high, ...med].map((f) => `${f.sev} ${f.file}:${f.line} "${f.term}" — ${f.fix}`).join('\n');
    const body = { action: 'create', items: [{ type: 'TASK', title: `Marketing claims governance: ${high.length} HIGH / ${med.length} MED wording flags`, detail, urgency: high.length ? 'P0' : 'P2' }] };
    const r = await fetch(`${base}/api/build/queue`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) }).then((x) => x.json()).catch((e) => ({ ok: false, error: String(e) }));
    console.log('\nBuild-board task:', r.ok ? `created (${r.createdCount})` : `failed: ${r.error}`);
  }
}

// Exit non-zero on HIGH so CI can gate new risky copy before it ships.
process.exit(high.length ? 1 : 0);
