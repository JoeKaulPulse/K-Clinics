// Parser for the clinic's price-matrix paste format. One row per line, tab- or
// multi-space separated:
//   <name> <N> session   <total£>   <perSession£>   <sessions>   <mins>   <mins+doc>
// Rows that share a base name (differing only by "N session") collapse into one
// variant with course options. Pure + dependency-free so it runs client-side
// (live preview) and server-side (write). Tolerant of the messy real export:
// pure-number lines (row numbers), "NN%" headers, "*Price…" notes, "£"/"per
// vial" prices, and "& …" name continuations.

export type ParsedVariant = {
  name: string;
  durationMin: number;
  pricePence: number;       // single-session (lowest sessions) price
  courses: { sessions: number; totalPence: number }[];
};
export type ParseResult = { variants: ParsedVariant[]; rowCount: number; warnings: string[] };

function parseMoney(s: string | undefined): number | null {
  if (s == null) return null;
  const txt = String(s).trim();
  if (!txt || /consult/i.test(txt)) return 0; // "on consultation"
  const m = txt.replace(/[£,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0]) * 100) : null;
}
const int = (s: string | undefined): number | null => {
  const m = (s ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};
const splitCols = (line: string) => line.split(/\t+|\s{2,}/).map((c) => c.trim());
const sessionRe = /(\d+)\s*ses\w*\s*$/i; // "1 session", "3 sesission", "10 sessions"
const isContinuation = (s: string) => /^[&/+]/.test(s.trim());

export function parsePriceMatrix(raw: string): ParseResult {
  const warnings: string[] = [];
  const lines = raw.replace(/\r/g, '').split('\n');
  type Row = { base: string; sessions: number; totalPence: number; durationMin: number };
  const rows: Row[] = [];
  let pendingName: string | null = null;

  for (const lineRaw of lines) {
    const line = lineRaw.replace(/\s+$/, '');
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) continue;          // spreadsheet row number
    if (/^\*/.test(trimmed)) continue;             // "*Price Upon Consultation" note

    const hasCols = /\t/.test(line) || /\s{2,}\S/.test(line);
    if (!hasCols) {
      if (/\d+\s*%/.test(trimmed)) { pendingName = null; continue; } // category % header
      // Either a section header or the first line of a wrapped name — remember it.
      pendingName = trimmed;
      continue;
    }

    const cols = splitCols(line);
    let name: string;
    let nums: string[];
    if (sessionRe.test(cols[0])) {
      name = pendingName && isContinuation(cols[0]) ? `${pendingName} ${cols[0]}` : cols[0];
      nums = cols.slice(1);
    } else {
      // Price-first row: the name was on the previous (tabless) line.
      name = pendingName ?? cols[0];
      nums = pendingName ? cols : cols.slice(1);
    }
    pendingName = null;

    const sm = name.match(sessionRe);
    const sessions = sm ? parseInt(sm[1], 10) : (int(nums[2]) ?? 1);
    const base = name.replace(sessionRe, '').trim().replace(/\s+/g, ' ');
    const total = parseMoney(nums[0]);
    if (!base || total == null) { warnings.push(`Skipped: ${trimmed.slice(0, 60)}`); continue; }
    const durationMin = int(nums[4]) ?? int(nums[3]) ?? 30; // prefer "mins + doc"
    rows.push({ base, sessions, totalPence: total, durationMin });
  }

  // Group rows into variants (preserve first-seen order).
  const order: string[] = [];
  const byBase = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byBase.has(r.base)) { byBase.set(r.base, []); order.push(r.base); }
    byBase.get(r.base)!.push(r);
  }
  const variants: ParsedVariant[] = order.map((base) => {
    const list = byBase.get(base)!.sort((a, b) => a.sessions - b.sessions);
    const single = list[0];
    return {
      name: base,
      durationMin: single.durationMin,
      pricePence: single.totalPence,
      courses: list.filter((r) => r.sessions > 1).map((r) => ({ sessions: r.sessions, totalPence: r.totalPence })),
    };
  });

  return { variants, rowCount: rows.length, warnings };
}
