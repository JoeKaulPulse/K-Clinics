// Streaming parser for a mysqldump `.sql` file.
//
// Designed to chew through large dumps (90 MB+) with bounded memory: it reads
// line by line and only materialises rows for the tables a caller actually asks
// for. Everything else is counted and discarded.
//
// mysqldump quirks handled:
//   • CREATE TABLE blocks span many lines — columns captured in declared order
//     (needed because default dumps put no column list on INSERTs).
//   • INSERT ... VALUES (..),(..); — extended inserts, many rows per statement.
//   • A statement may (rarely) wrap across lines — accumulated until ';'.
//   • String escaping: backslash escapes (\n \t \\ \' …) and doubled ''.
//   • --complete-insert column lists before VALUES are skipped.
//
// No external dependencies — pure Node, safe to run anywhere with `node`.

import fs from 'node:fs';
import readline from 'node:readline';

/** Parse the VALUES portion of an INSERT into an array of row arrays. */
export function parseValues(s) {
  const rows = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && s[i] !== '(') i++; // advance to the next row tuple
    if (i >= n) break;
    i++; // skip '('
    const row = [];
    while (i < n) {
      while (i < n && /\s/.test(s[i])) i++;
      const c = s[i];
      if (c === ')') { i++; break; }
      if (c === ',') { i++; continue; }
      if (c === "'") {
        i++;
        let str = '';
        while (i < n) {
          const ch = s[i];
          if (ch === '\\') {
            const nx = s[i + 1];
            const map = { '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\x1a', '\\': '\\', "'": "'", '"': '"' };
            str += nx in map ? map[nx] : nx;
            i += 2;
          } else if (ch === "'") {
            if (s[i + 1] === "'") { str += "'"; i += 2; } // doubled quote
            else { i++; break; }
          } else { str += ch; i++; }
        }
        row.push(str);
      } else {
        let j = i;
        while (j < n && s[j] !== ',' && s[j] !== ')') j++;
        const tok = s.slice(i, j).trim();
        row.push(tok === 'NULL' ? null : /^-?\d+(\.\d+)?$/.test(tok) ? Number(tok) : tok);
        i = j;
      }
    }
    rows.push(row);
  }
  return rows;
}

const CREATE_RE = /^CREATE TABLE [`"]?([A-Za-z0-9_]+)[`"]?/i;
const INSERT_RE = /^INSERT INTO [`"]?([A-Za-z0-9_]+)[`"]?/i;
const COL_RE = /^\s*[`"]([A-Za-z0-9_]+)[`"]\s+/;
const NONCOL_RE = /^\s*(PRIMARY|UNIQUE|KEY|CONSTRAINT|INDEX|FULLTEXT|SPATIAL|FOREIGN|\))/i;

/**
 * Stream a dump file, invoking callbacks as tables/rows are encountered.
 *
 * @param {string} path
 * @param {object} cb
 * @param {(table:string)=>boolean} [cb.wantRows]  return true to receive parsed rows
 * @param {(table:string, columns:string[])=>void} [cb.onSchema]
 * @param {(table:string, count:number)=>void} [cb.onCount]   per INSERT statement
 * @param {(table:string, rows:any[][])=>void} [cb.onRows]    wanted tables only
 */
export async function streamDump(path, cb = {}) {
  const wantRows = cb.wantRows || (() => false);
  const rl = readline.createInterface({ input: fs.createReadStream(path, 'utf8'), crlfDelay: Infinity });

  let createTable = null;          // table whose columns we're collecting
  let createCols = [];
  const columns = new Map();       // table -> string[]
  let pending = '';                // accumulator for a multi-line statement

  const handleStatement = (stmt) => {
    const ins = stmt.match(INSERT_RE);
    if (!ins) return;
    const table = ins[1];
    const vm = stmt.match(/\bVALUES\b/i);
    if (!vm) return;
    const rows = parseValues(stmt.slice(vm.index + 6));
    cb.onCount?.(table, rows.length);
    if (wantRows(table)) {
      // Map to column names so callers index by name, not position.
      const cols = columns.get(table) || [];
      const named = rows.map((r) => {
        const o = {};
        for (let k = 0; k < cols.length; k++) o[cols[k]] = r[k];
        o.__row = r;
        return o;
      });
      cb.onRows?.(table, named);
    }
  };

  for await (const line of rl) {
    if (createTable) {
      if (NONCOL_RE.test(line)) {
        if (/^\s*\)/.test(line)) { // end of CREATE TABLE
          columns.set(createTable, createCols);
          cb.onSchema?.(createTable, createCols);
          createTable = null; createCols = [];
        }
        continue;
      }
      const cm = line.match(COL_RE);
      if (cm) createCols.push(cm[1]);
      continue;
    }

    if (pending) {
      pending += '\n' + line;
      if (/;\s*$/.test(line)) { handleStatement(pending); pending = ''; }
      continue;
    }

    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed.startsWith('LOCK ') || trimmed.startsWith('UNLOCK')) continue;

    const cre = line.match(CREATE_RE);
    if (cre) { createTable = cre[1]; createCols = []; continue; }

    if (INSERT_RE.test(line)) {
      if (/;\s*$/.test(line)) handleStatement(line);
      else pending = line; // statement wraps onto following lines
    }
  }
  if (pending) handleStatement(pending);

  return { columns };
}

/** Lower-case + trim an email; '' for empties so callers can skip. */
export function normEmail(v) {
  return (v == null ? '' : String(v)).trim().toLowerCase();
}

/** Parse a mysql datetime ('YYYY-MM-DD HH:MM:SS') as UTC; null if unusable. */
export function parseDate(v) {
  if (!v || typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.startsWith('0000')) return null;
  const d = new Date(s.replace(' ', 'T') + (/[zZ+]/.test(s) ? '' : 'Z'));
  return isNaN(d.getTime()) ? null : d;
}
