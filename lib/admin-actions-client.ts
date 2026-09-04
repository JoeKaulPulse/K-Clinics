'use client';

export type ActionResult = { ok: boolean; error?: string };

/** POST JSON to an admin action endpoint and normalise its outcome. Checks
 *  res.ok (not just that fetch() itself didn't throw) so a failed API call —
 *  a permission error, a 500, a validation rejection — surfaces instead of
 *  being silently treated as a success by the caller (BLD-1581). */
export async function postAction(url: string, body: object): Promise<ActionResult> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j?.ok !== false) return { ok: true };
    return { ok: false, error: typeof j?.error === 'string' && j.error ? j.error : 'Couldn’t do that — try again.' };
  } catch {
    return { ok: false, error: 'Network error — try again.' };
  }
}
