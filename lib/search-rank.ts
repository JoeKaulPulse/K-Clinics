// Shared relevance scoring for search (admin + public). No 'server-only' so it
// can run on either side. Pure functions — given a haystack and a query it
// returns a numeric score; higher is a better match. Used to rank results so
// exact/prefix matches surface above incidental substring hits, instead of just
// "most recent first".

export function queryTerms(q: string): string[] {
  return q.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** Score how well `haystack` matches the query. 0 = no textual match found
 *  (the row may still be a valid hit via a field not represented here, so
 *  callers should rank — not filter — on this). */
export function relevance(haystack: string, q: string, terms?: string[]): number {
  if (!haystack) return 0;
  const h = haystack.toLowerCase();
  const query = q.toLowerCase().trim();
  const ts = terms ?? queryTerms(query);
  let score = 0;

  // Whole-query signals (strongest).
  if (h === query) score += 1000;
  else if (h.startsWith(query)) score += 240;
  else if (h.includes(query)) score += 80;

  // Per-term signals, rewarding word-boundary matches over mid-word ones.
  for (const t of ts) {
    const at = h.indexOf(t);
    if (at < 0) continue;
    if (at === 0) score += 45;
    else if (/[\s\-_/.,@]/.test(h.charAt(at - 1))) score += 28;
    else score += 9;
  }

  // Specificity: a short field that matches is usually a tighter hit than the
  // same term buried in a long one.
  if (score > 0) score += Math.max(0, 18 - Math.floor(h.length / 10));
  return score;
}

/** Rank hits (title weighted over sub) by relevance, stable on ties so the
 *  upstream order — typically recency — is preserved for equal scores. */
export function rankHits<T extends { title: string; sub?: string }>(hits: T[], q: string): T[] {
  const terms = queryTerms(q);
  return hits
    .map((h, i) => ({ h, i, s: relevance(h.title, q, terms) + 0.45 * relevance(h.sub || '', q, terms) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.h);
}

/** The best hit score in a list — used to order groups so the most relevant
 *  category leads. */
export function bestScore(hits: { title: string; sub?: string }[], q: string): number {
  const terms = queryTerms(q);
  return hits.reduce((m, h) => Math.max(m, relevance(h.title, q, terms) + 0.45 * relevance(h.sub || '', q, terms)), 0);
}
