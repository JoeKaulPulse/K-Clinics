import { unzipSync, strFromU8 } from 'fflate';
import { parsePriceMatrix, type ParsedVariant } from './price-import';

// Parse the clinic's price-list .xlsx into per-treatment sections. The sheet is
// segmented by yellow (FFFFFF00) header rows in column A; each block becomes a
// Service with its variants (course rows collapse via parsePriceMatrix).

export type PriceSection = {
  header: string;
  slugGuess: string | null;   // best-match treatment slug (admin can change it)
  raw: string;                // tab-separated matrix for this block (fed to parsePriceMatrix)
  variants: ParsedVariant[];
  warnings: string[];
};

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#10;/g, '\n');
const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => !['the', 'and', 'for', 'of', 'a', 'treatment', 'laser'].includes(t));

function guessSlug(header: string, treatments: { slug: string; title: string }[]): string | null {
  const ht = new Set(tokens(header));
  if (!ht.size) return null;
  let best: { slug: string; score: number } | null = null;
  for (const t of treatments) {
    const tt = tokens(t.title + ' ' + t.slug.replace(/-/g, ' '));
    const overlap = tt.filter((x) => ht.has(x)).length;
    const score = overlap / Math.max(1, Math.min(ht.size, tt.length));
    if (overlap > 0 && (!best || score > best.score)) best = { slug: t.slug, score };
  }
  return best && best.score >= 0.34 ? best.slug : null;
}

export function parsePricelistXlsx(buf: Uint8Array, treatments: { slug: string; title: string }[]): { sections: PriceSection[]; warnings: string[] } {
  const files = unzipSync(buf);
  const get = (re: RegExp) => { const k = Object.keys(files).find((f) => re.test(f)); return k ? strFromU8(files[k]) : ''; };
  const ssXml = get(/^xl\/sharedStrings\.xml$/);
  const stylesXml = get(/^xl\/styles\.xml$/);
  const sheetXml = get(/^xl\/worksheets\/sheet1\.xml$/) || get(/^xl\/worksheets\/.*\.xml$/);
  if (!sheetXml) return { sections: [], warnings: ['Could not read the worksheet.'] };

  const strings = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')));
  const fills = [...stylesXml.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((f) => { const m = f[1].match(/<(?:fg|bg)Color[^>]*rgb="([0-9A-Fa-f]{8})"/); return m ? m[1].toUpperCase() : null; });
  const xfs = [...(((stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1]) || '').matchAll(/<xf\b[^>]*?fillId="(\d+)"[^>]*?>(?:[\s\S]*?<\/xf>)?/g)].map((x) => +x[1]);
  const fillOf = (s: number) => fills[xfs[s] ?? 0] ?? null;

  const ROW_RE = new RegExp('<row[^>]*r="(\\d+)"[^>]*>([\\s\\S]*?)</row>', 'g');
  const CELL_RE = new RegExp('<c r="([A-Z]+)\\d+"(?:[^>]*?s="(\\d+)")?(?:[^>]*?t="([a-z]+)")?[^>]*>(?:<v>([\\s\\S]*?)</v>|<is><t[^>]*>([\\s\\S]*?)</t></is>)?</c>', 'g');
  const rows = [...sheetXml.matchAll(ROW_RE)].map((r) => {
    const cells: Record<string, string> = {}; let aFill: string | null = null;
    for (const c of r[2].matchAll(CELL_RE)) {
      const col = c[1], s = c[2] ? +c[2] : 0, t = c[3], v = c[4] ?? c[5];
      cells[col] = v == null ? '' : (t === 's' ? (strings[+v] ?? '') : decode(String(v)));
      if (col === 'A') aFill = fillOf(s);
    }
    return { cells, aFill };
  });

  const sections: { header: string; rows: Record<string, string>[] }[] = [];
  let cur: { header: string; rows: Record<string, string>[] } | null = null;
  for (const row of rows) {
    const a = (row.cells.A || '').trim();
    if (row.aFill === 'FFFFFF00' && a) { cur = { header: a, rows: [] }; sections.push(cur); continue; }
    if (cur && a) cur.rows.push(row.cells);
  }

  const out: PriceSection[] = sections.map((sec) => {
    const raw = sec.rows.map((c) => [c.A, c.B, c.C, c.D, c.E, c.F].map((x) => (x ?? '').trim()).join('\t')).join('\n');
    const parsed = parsePriceMatrix(raw);
    return { header: sec.header.trim(), slugGuess: guessSlug(sec.header, treatments), raw, variants: parsed.variants, warnings: parsed.warnings };
  }).filter((s) => s.variants.length > 0);

  return { sections: out, warnings: out.length ? [] : ['No priced sections were found — check the spreadsheet format.'] };
}
