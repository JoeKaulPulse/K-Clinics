// Guard: lib/build-backlog.ts must use straight ASCII quotes (' " `) as string
// DELIMITERS. Curly/smart quotes are perfectly fine INSIDE a string (prose like
// “don’t”) — but never as a delimiter. A routine once generated an entry as
// `title: ‘X’` with curly quotes, which is invalid TS and broke the Vercel build.
// This runs in prebuild so it fails fast with a clear message before tsc/build.
//
// We scan char-by-char, skipping over straight-quoted strings AND // and /* */
// comments; any curly quote seen in "code" position (i.e. a delimiter) fails.
import { readFileSync } from 'fs';

const FILE = 'lib/build-backlog.ts';
const CURLY = new Set(['‘', '’', '“', '”']); // ‘ ’ “ ”

let src;
try { src = readFileSync(FILE, 'utf8'); } catch { console.log(`[check-backlog-quotes] ${FILE} not found — skipping`); process.exit(0); }

let mode = 'code'; // code | str | line | block
let delim = '';
let line = 1;
const bad = [];

for (let i = 0; i < src.length; i++) {
  const c = src[i];
  const n = src[i + 1];
  if (c === '\n') line++;

  if (mode === 'str') {
    if (c === '\\') { i++; continue; }      // skip escaped char
    if (c === delim) mode = 'code';
    continue;
  }
  if (mode === 'line') { if (c === '\n') mode = 'code'; continue; }
  if (mode === 'block') { if (c === '*' && n === '/') { i++; mode = 'code'; } continue; }

  // mode === 'code'
  if (c === '/' && n === '/') { mode = 'line'; i++; continue; }
  if (c === '/' && n === '*') { mode = 'block'; i++; continue; }
  if (c === "'" || c === '"' || c === '`') { mode = 'str'; delim = c; continue; }
  if (CURLY.has(c)) bad.push(line);
}

if (bad.length) {
  console.error(`\n[check-backlog-quotes] FAIL: curly/smart quote used as a string delimiter in ${FILE} on line(s): ${[...new Set(bad)].join(', ')}.`);
  console.error("Use straight ASCII quotes (' or \") for delimiters; curly quotes are only allowed inside string text.\n");
  process.exit(1);
}
console.log('[check-backlog-quotes] ok — straight delimiters');
