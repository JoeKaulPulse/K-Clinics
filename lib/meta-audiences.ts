import 'server-only';
import crypto from 'node:crypto';
import { getConnection } from '@/lib/oauth-connections';
import { rulesToWhere, type SegmentRules } from '@/lib/segments';

// Push a client segment to Meta as a Custom Audience (and a base for Lookalikes)
// so it can be retargeted / prospected in Meta Ads. Best-effort; never throws.
//
// ⚠ ACTIVATION: creating audiences needs the Meta `ads_management` permission.
// The current connection requests `ads_read`, so until the Meta app is
// re-authorised with `ads_management` (and passes Meta App Review), the create
// call returns a permissions error and this reports it cleanly — it never
// uploads anything it shouldn't.
//
// PRIVACY (UK GDPR / PECR): only marketing-opted-in, non-unsubscribed clients are
// ever uploaded — enforced here regardless of the segment's own rules — and only
// SHA-256 hashes of email/phone leave the server (Meta's required format).

const GRAPH = 'https://graph.facebook.com/v23.0';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const normEmail = (e: string) => e.trim().toLowerCase();
// Meta wants E.164-style digits with country code, no symbols. Assume UK when a
// local 0-prefixed number is given.
const normPhone = (p: string) => {
  const digits = p.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('44')) return digits;
  if (digits.startsWith('0')) return `44${digits.slice(1)}`;
  return digits;
};

/** True when Meta is connected with an ad account selected. (Doesn't prove the
 *  `ads_management` scope — that only surfaces when the create call runs.) */
export async function metaAudiencesConfigured(): Promise<boolean> {
  const conn = await getConnection('meta');
  return Boolean(conn?.tokens.access && conn?.accountRef);
}

async function createCustomAudience(accountId: string, token: string, name: string, description: string): Promise<{ id?: string; error?: string }> {
  const res = await fetch(`${GRAPH}/${accountId}/customaudiences`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, subtype: 'CUSTOM', customer_file_source: 'USER_PROVIDED_ONLY', description, access_token: token }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = await res.json().catch(() => ({}));
  if (j?.id) return { id: String(j.id) };
  return { error: j?.error?.message || `Meta create failed (HTTP ${res.status})` };
}

/** Upload hashed members in chunks. Returns the number Meta accepted. */
async function addUsers(audienceId: string, token: string, rows: { email: string | null; phone: string | null }[]): Promise<number> {
  const schema = ['EMAIL', 'PHONE'];
  const data = rows
    .map((r) => [r.email ? sha256(normEmail(r.email)) : '', r.phone ? sha256(normPhone(r.phone)) : ''])
    .filter((row) => row[0] || row[1]);
  let received = 0;
  for (let i = 0; i < data.length; i += 5000) {
    const chunk = data.slice(i, i + 5000);
    const res = await fetch(`${GRAPH}/${audienceId}/users`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { schema, data: chunk }, access_token: token }),
      signal: AbortSignal.timeout(20_000),
    });
    const j = await res.json().catch(() => ({}));
    received += Number(j?.num_received ?? 0);
  }
  return received;
}

export async function syncSegmentToMeta(segmentId: string): Promise<{ ok: boolean; audienceId?: string; count?: number; error?: string }> {
  try {
    const { db } = await import('@/lib/db');
    const conn = await getConnection('meta');
    if (!conn?.tokens.access || !conn?.accountRef) {
      return { ok: false, error: 'Meta isn’t connected, or no ad account is selected. Connect it under Marketing → Connections first.' };
    }
    const token = conn.tokens.access;
    const accountId = conn.accountRef.startsWith('act_') ? conn.accountRef : `act_${conn.accountRef}`;

    const seg = await db.segment.findUnique({ where: { id: segmentId } });
    if (!seg) return { ok: false, error: 'Segment not found.' };
    const rules = (seg.rules as SegmentRules) ?? {};

    // CONSENT GATE — only marketing-opted-in, non-unsubscribed clients may go to an
    // ad platform, whatever the segment rules say (UK GDPR / PECR).
    const where = { ...rulesToWhere(rules), marketingOptIn: true, unsubscribed: false };
    const members = await db.client.findMany({ where, select: { email: true, phone: true } });
    if (members.length === 0) return { ok: false, error: 'No marketing-opted-in clients match this segment — nothing to upload.' };

    let audienceId = seg.metaAudienceId;
    if (!audienceId) {
      const created = await createCustomAudience(accountId, token, `K Clinics — ${seg.name}`, seg.description || `Synced from the “${seg.name}” segment.`);
      if (!created.id) return { ok: false, error: `${created.error} (the connection likely needs the ads_management permission).` };
      audienceId = created.id;
      await db.segment.update({ where: { id: segmentId }, data: { metaAudienceId: audienceId } });
    }

    const count = await addUsers(audienceId, token, members);
    await db.segment.update({ where: { id: segmentId }, data: { metaSyncedAt: new Date() } });
    return { ok: true, audienceId, count };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'Sync failed.' };
  }
}
