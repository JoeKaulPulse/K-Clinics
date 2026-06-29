import 'server-only';
import { db } from '@/lib/db';

// BLD-561 — keeping obvious test/junk client records out of the way without
// destroying anything. The WordPress migration already tagged junk signups
// `likely-test` (scripts/migrate-wp), but clients created since (e.g. a staff
// member testing the booking flow) are never tagged, so they clutter the list,
// search and counts. This brings that same heuristic in-app: a conservative,
// reversible scan that only *tags* records — the admin list then hides tagged
// rows by default, with a one-click reveal. Nothing is deleted.

export const TEST_CLIENT_TAG = 'likely-test';

// Keyboard mashes / placeholder words people type into a "first name" box.
const KB_MASH = /^(qwerty|asdf|zxcv|qwe|asd|zxc|wsx|edc|test|demo|sample|www+|abcd?|abc123|sdfg|dfgd?|fghj|hjkl|xxx+|aaa+|zzz+|qqq+|wer|ert|rty|asdasd|qweqwe)$/i;

/** Heuristic: does this look like a test/junk signup rather than a real person?
 *  Name/email shape only — callers gate on "no real activity" before trusting it
 *  to tag, so a genuine client who merely has an odd name is never caught. */
export function isLikelyTestClient(c: { firstName?: string | null; lastName?: string | null; email?: string | null }): boolean {
  const f = (c.firstName || '').trim();
  const l = (c.lastName || '').trim();
  if (f && l && f.toLowerCase() === l.toLowerCase()) return true; // "qwerty qwerty"
  if (/\d/.test(f)) return true;                                  // "Www5"
  if (KB_MASH.test(f)) return true;
  const local = String(c.email || '').split('@')[0];
  const gibberish = local.length >= 6 && local.length <= 14 && !/[._-]/.test(local) && /[a-z]\d/i.test(local) && /\d[a-z]/i.test(local);
  if (gibberish && f.length <= 8) return true;                    // bot signup e.g. "jrq17j9t"
  return false;
}

/**
 * Scan inert client records and tag the obvious test/junk ones `likely-test`.
 * Conservative on purpose: only considers records with **no real activity** (no
 * bookings, no recorded visit, not marketing-opted-in) and not already tagged,
 * so a real client is never hidden. Reversible — it only adds a tag; removing it
 * un-hides the record. Returns how many were examined and newly tagged.
 */
export async function scanAndTagTestClients(opts: { limit?: number } = {}): Promise<{ scanned: number; tagged: number }> {
  const take = Math.min(Math.max(opts.limit ?? 5000, 1), 20000);
  const candidates = await db.client.findMany({
    where: {
      NOT: { tags: { has: TEST_CLIENT_TAG } },
      marketingOptIn: false,
      lastVisitAt: null,
      bookings: { none: {} },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take,
  });

  let tagged = 0;
  for (const c of candidates) {
    if (!isLikelyTestClient(c)) continue;
    await db.client.update({ where: { id: c.id }, data: { tags: { push: TEST_CLIENT_TAG } } }).catch(() => {});
    tagged++;
  }
  return { scanned: candidates.length, tagged };
}

/** Remove the test tag from a record the admin has confirmed is genuine. */
export async function untagTestClient(clientId: string): Promise<void> {
  const c = await db.client.findUnique({ where: { id: clientId }, select: { tags: true } });
  if (!c) return;
  await db.client.update({ where: { id: clientId }, data: { tags: { set: c.tags.filter((t) => t !== TEST_CLIENT_TAG) } } }).catch(() => {});
}
