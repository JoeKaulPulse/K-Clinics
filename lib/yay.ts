import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';
import { encClinical } from '@/lib/clinical-crypto';

// ── yay.com VoIP integration ────────────────────────────────────────────────
// Ingests call events from yay.com (webhook), matches the caller against the
// CRM by number, stores an immutable CallRecord, and exposes click-to-dial.
// The webhook parser reads several common field names so it tolerates yay's
// exact payload shape; the original payload is always stored in `raw`.

const API_BASE = (process.env.YAY_API_BASE || 'https://api.yay.com').replace(/\/$/, '');

/** Digits only. */
function digits(s?: string | null): string {
  return (s || '').replace(/\D/g, '');
}

/** The significant trailing digits used for fuzzy number matching (handles
 *  +44 / 0 / spacing differences). */
function sig(s?: string | null): string {
  const d = digits(s).replace(/^(44|0)+/, '');
  return d.slice(-9);
}

type Pick = Record<string, unknown>;
const first = (o: Pick, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return undefined;
};

export type CallerMatch = { type: 'CLIENT' | 'SUPPLIER' | 'STAFF' | 'UNKNOWN'; clientId?: string; supplierId?: string; label: string };

/** Resolve an inbound/outbound number to a CRM entity — a client first, then a
 *  supplier, both matched on phone; otherwise the formatted number is the label. */
export async function matchCaller(number: string): Promise<CallerMatch> {
  const s = sig(number);
  if (s.length >= 6) {
    const client = await db.client.findFirst({
      where: { phone: { contains: s } },
      select: { id: true, firstName: true, lastName: true },
    }).catch(() => null);
    if (client) return { type: 'CLIENT', clientId: client.id, label: [client.firstName, client.lastName].filter(Boolean).join(' ') || number };

    const supplier = await db.supplier.findFirst({
      where: { active: true, phone: { contains: s } },
      select: { id: true, name: true },
    }).catch(() => null);
    if (supplier) return { type: 'SUPPLIER', supplierId: supplier.id, label: supplier.name };
  }
  return { type: 'UNKNOWN', label: number || 'Unknown caller' };
}

type ParsedCall = {
  yayId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  fromNumber: string;
  toNumber: string;
  status?: string;
  startedAt: Date;
  answeredAt?: Date;
  endedAt?: Date;
  durationSec: number;
  externalNumber: string;     // the real outside number (caller for inbound, callee for outbound)
  agentExtension?: string;
  agentEmail?: string;
  recordingUrl?: string;
  recordingMime?: string;
  transcript?: string;
};

// yay sends UK wall-clock timestamps like "2019-10-18 09:58:35" (no timezone).
// Interpret them as Europe/London and convert to a real instant.
function londonOffsetMs(utc: number): number {
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = dtf.formatToParts(new Date(utc));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  let h = g('hour'); if (h === 24) h = 0;
  return Date.UTC(g('year'), g('month') - 1, g('day'), h, g('minute'), g('second')) - utc;
}

const toDate = (v?: string): Date | undefined => {
  if (!v) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v);
  if (m) {
    const [, Y, Mo, D, H, Mi, S] = m.map(Number);
    const utcGuess = Date.UTC(Y, Mo - 1, D, H, Mi, S);
    return new Date(utcGuess - londonOffsetMs(utcGuess));
  }
  const n = Number(v);
  const d = Number.isFinite(n) && v.length >= 10 ? new Date(n * (v.length <= 10 ? 1000 : 1)) : new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

/** Parse a yay webhook body (Call Ended / Voicemail Notify / etc.) into our shape. */
export function parseYayEvent(body: Pick): ParsedCall | null {
  const yayId = first(body, ['uuid', 'call_id', 'callId', 'id', 'cdr_id', 'session_id']);
  if (!yayId) return null;
  const dirRaw = (first(body, ['call_type', 'direction', 'call_direction', 'type']) || '').toLowerCase();
  const direction: 'INBOUND' | 'OUTBOUND' = /out/.test(dirRaw) ? 'OUTBOUND' : 'INBOUND';
  const fromNumber = first(body, ['from', 'caller', 'cli', 'source', 'from_number', 'caller_id']) || 'unknown';
  const toNumber = first(body, ['to', 'destination', 'dnis', 'to_number', 'called']) || site.phone;
  const fromType = first(body, ['from_type']) || '';
  const toType = first(body, ['to_type']) || '';
  const mailbox = first(body, ['mailbox']);
  const started = toDate(first(body, ['start', 'start_time', 'started_at', 'created_at', 'received_at', 'time'])) || new Date();
  const answered = toDate(first(body, ['answered_at', 'answer_time', 'answer']));
  const ended = toDate(first(body, ['end', 'end_time', 'ended_at', 'hangup_time']));
  const durStr = first(body, ['duration', 'billsec', 'talk_time', 'seconds']);
  const durationSec = durStr ? Math.max(0, Math.round(Number(durStr) || 0)) : (answered && ended ? Math.round((ended.getTime() - answered.getTime()) / 1000) : 0);

  // The external number is whichever side is NOT one of our SIP extensions
  // (caller for inbound/voicemail, callee for outbound).
  const externalNumber = fromType === 'sipuser' ? toNumber
    : toType === 'sipuser' ? fromNumber
    : direction === 'INBOUND' ? fromNumber : toNumber;

  // yay's Call Ended has no status field — derive one.
  const status = first(body, ['status', 'disposition', 'result'])
    || (mailbox ? 'voicemail' : answered ? 'answered' : direction === 'INBOUND' ? 'missed' : 'no-answer');

  return {
    yayId,
    direction,
    fromNumber,
    toNumber,
    status,
    startedAt: started,
    answeredAt: answered,
    endedAt: ended,
    durationSec,
    externalNumber,
    agentExtension: first(body, ['answered_by', 'extension', 'agent_extension', 'user', 'ext']),
    agentEmail: first(body, ['agent_email', 'user_email', 'email']),
    recordingUrl: first(body, ['recording_url', 'recording', 'record_url', 'recordingUrl']),
    recordingMime: first(body, ['recording_mime', 'recording_type']),
    transcript: first(body, ['transcription', 'transcript', 'transcript_text']),
  };
}

/**
 * Idempotently store/enrich a CallRecord from a parsed event. Core call facts
 * are written once on creation; subsequent events for the same call only fill
 * in the recording/transcript (never rewrite the record).
 */
export async function ingestCall(parsed: ParsedCall, raw: unknown): Promise<{ id: string; created: boolean }> {
  const existing = await db.callRecord.findUnique({ where: { yayId: parsed.yayId }, select: { id: true } });

  if (existing) {
    // Enrichment only — fill in later events (answer, end, recording, voicemail
    // transcript) without rewriting the original facts.
    const data: Record<string, unknown> = {};
    if (parsed.recordingUrl) { data.recordingUrl = encClinical(parsed.recordingUrl); if (parsed.recordingMime) data.recordingMime = parsed.recordingMime; }
    if (parsed.transcript) { data.transcript = encClinical(parsed.transcript); data.transcriptStatus = 'ready'; }
    if (parsed.answeredAt) data.answeredAt = parsed.answeredAt;
    if (parsed.endedAt) data.endedAt = parsed.endedAt;
    if (parsed.durationSec) data.durationSec = parsed.durationSec;
    if (parsed.status) data.status = parsed.status;
    if (Object.keys(data).length) await db.callRecord.update({ where: { id: existing.id }, data });
    return { id: existing.id, created: false };
  }

  const match = await matchCaller(parsed.externalNumber);

  const rec = await db.callRecord.create({
    data: {
      yayId: parsed.yayId,
      direction: parsed.direction,
      fromNumber: parsed.fromNumber,
      toNumber: parsed.toNumber,
      status: parsed.status ?? null,
      startedAt: parsed.startedAt,
      answeredAt: parsed.answeredAt ?? null,
      endedAt: parsed.endedAt ?? null,
      durationSec: parsed.durationSec,
      agentExtension: parsed.agentExtension ?? null,
      agentEmail: parsed.agentEmail ?? null,
      recordingUrl: parsed.recordingUrl ? encClinical(parsed.recordingUrl) : null,
      recordingMime: parsed.recordingMime ?? null,
      transcript: parsed.transcript ? encClinical(parsed.transcript) : null,
      transcriptStatus: parsed.transcript ? 'ready' : 'pending',
      matchType: match.type,
      matchedClientId: match.clientId ?? null,
      matchedSupplierId: match.supplierId ?? null,
      matchedLabel: match.type === 'CLIENT' || match.type === 'SUPPLIER' ? null : match.label,
      raw: (raw ?? null) as object,
    },
    select: { id: true },
  });

  // Log this call against the client's interaction timeline (best-effort).
  if (match.clientId) {
    await db.interaction.create({
      data: {
        clientId: match.clientId,
        type: 'CALL',
        summary: `${parsed.direction === 'INBOUND' ? 'Inbound' : 'Outbound'} call · ${Math.round(parsed.durationSec / 60)}m ${parsed.durationSec % 60}s`,
      },
    }).catch(() => {});
  }
  return { id: rec.id, created: true };
}

/**
 * Click-to-dial: ask yay.com to ring `agent` (a SIP extension) and connect to
 * `to`. Best-effort — needs the yay JSON-API credentials (X-Auth-Reseller /
 * X-Auth-User / X-Auth-Password) AND this server's egress IP added to yay's
 * "Allowed IP ranges". The exact command path may need confirming against yay's
 * API docs; override the base with YAY_API_BASE.
 *
 * Not required for call logging (that's inbound webhooks) — only for placing
 * calls from the dashboard once staff SIP extensions/handsets are set up.
 */
export async function clickToCall({ agent, to }: { agent: string; to: string }): Promise<{ ok: boolean; error?: string }> {
  const reseller = process.env.YAY_AUTH_RESELLER;
  const user = process.env.YAY_AUTH_USER || 'admin';
  const password = process.env.YAY_AUTH_PASSWORD;
  if (!reseller || !password) return { ok: false, error: 'yay.com API credentials are not configured.' };
  if (!agent || !to) return { ok: false, error: 'Missing agent extension or destination number.' };
  try {
    const res = await fetch(`${API_BASE}/calls/click-to-dial`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Auth-Reseller': reseller,
        'X-Auth-User': user,
        'X-Auth-Password': password,
      },
      body: JSON.stringify({ from: agent, to, caller_id: digits(site.phoneHref) }),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'yay.com rejected the request — check the API password and that this server’s IP is allow-listed in yay.' };
    if (!res.ok) return { ok: false, error: `yay.com responded ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
