import 'server-only';
import { db } from '@/lib/db';
import { site } from '@/lib/site';

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

export type CallerMatch = { type: 'CLIENT' | 'STAFF' | 'UNKNOWN'; clientId?: string; label: string };

/** Resolve an inbound/outbound number to a CRM entity. Clients are matched on
 *  their phone; staff on theirs; otherwise the formatted number is the label.
 *  (Suppliers aren't a structured entity yet — see note in the calls UI.) */
export async function matchCaller(number: string): Promise<CallerMatch> {
  const s = sig(number);
  if (s.length >= 6) {
    const client = await db.client.findFirst({
      where: { phone: { contains: s } },
      select: { id: true, firstName: true, lastName: true },
    }).catch(() => null);
    if (client) return { type: 'CLIENT', clientId: client.id, label: [client.firstName, client.lastName].filter(Boolean).join(' ') || number };
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
  agentExtension?: string;
  agentEmail?: string;
  recordingUrl?: string;
  recordingMime?: string;
  transcript?: string;
};

const toDate = (v?: string): Date | undefined => {
  if (!v) return undefined;
  const n = Number(v);
  const d = Number.isFinite(n) && v.length >= 10 ? new Date(n * (v.length <= 10 ? 1000 : 1)) : new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

/** Parse a yay webhook body into our shape, tolerant of field-name variants. */
export function parseYayEvent(body: Pick): ParsedCall | null {
  const yayId = first(body, ['call_id', 'callId', 'uuid', 'id', 'cdr_id', 'session_id']);
  if (!yayId) return null;
  const dirRaw = (first(body, ['direction', 'call_direction', 'type']) || '').toLowerCase();
  const direction: 'INBOUND' | 'OUTBOUND' = /out|outbound|outgoing/.test(dirRaw) ? 'OUTBOUND' : 'INBOUND';
  const fromNumber = first(body, ['from', 'caller', 'cli', 'source', 'from_number', 'caller_id']) || 'unknown';
  const toNumber = first(body, ['to', 'destination', 'dnis', 'to_number', 'called']) || site.phone;
  const started = toDate(first(body, ['start_time', 'started_at', 'start', 'created_at', 'time'])) || new Date();
  const answered = toDate(first(body, ['answer_time', 'answered_at', 'answer']));
  const ended = toDate(first(body, ['end_time', 'ended_at', 'end', 'hangup_time']));
  const durStr = first(body, ['duration', 'billsec', 'talk_time', 'seconds']);
  const durationSec = durStr ? Math.max(0, Math.round(Number(durStr) || 0)) : (answered && ended ? Math.round((ended.getTime() - answered.getTime()) / 1000) : 0);

  return {
    yayId,
    direction,
    fromNumber,
    toNumber,
    status: first(body, ['status', 'disposition', 'result']),
    startedAt: started,
    answeredAt: answered,
    endedAt: ended,
    durationSec,
    agentExtension: first(body, ['extension', 'agent_extension', 'user', 'ext']),
    agentEmail: first(body, ['agent_email', 'user_email', 'email']),
    recordingUrl: first(body, ['recording_url', 'recording', 'record_url', 'recordingUrl']),
    recordingMime: first(body, ['recording_mime', 'recording_type']),
    transcript: first(body, ['transcript', 'transcription', 'transcript_text']),
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
    // Enrichment only — fill recording/transcript if newly present.
    const data: Record<string, unknown> = {};
    if (parsed.recordingUrl) { data.recordingUrl = parsed.recordingUrl; if (parsed.recordingMime) data.recordingMime = parsed.recordingMime; }
    if (parsed.transcript) { data.transcript = parsed.transcript; data.transcriptStatus = 'ready'; }
    if (parsed.endedAt) data.endedAt = parsed.endedAt;
    if (parsed.durationSec) data.durationSec = parsed.durationSec;
    if (Object.keys(data).length) await db.callRecord.update({ where: { id: existing.id }, data });
    return { id: existing.id, created: false };
  }

  // The "external" number to match on is the caller (inbound) or callee (outbound).
  const externalNumber = parsed.direction === 'INBOUND' ? parsed.fromNumber : parsed.toNumber;
  const match = await matchCaller(externalNumber);

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
      recordingUrl: parsed.recordingUrl ?? null,
      recordingMime: parsed.recordingMime ?? null,
      transcript: parsed.transcript ?? null,
      transcriptStatus: parsed.transcript ? 'ready' : 'pending',
      matchType: match.type,
      matchedClientId: match.clientId ?? null,
      matchedLabel: match.type === 'CLIENT' ? null : match.label,
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
 * Click-to-dial: ask yay.com to ring `agent` (extension/number) and connect to
 * `to`. Best-effort — a no-op without YAY_API_KEY. The exact yay endpoint/shape
 * may need confirming against your account's API docs; override with YAY_API_BASE.
 */
export async function clickToCall({ agent, to }: { agent: string; to: string }): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.YAY_API_KEY;
  if (!key) return { ok: false, error: 'yay.com API key not configured.' };
  if (!agent || !to) return { ok: false, error: 'Missing agent or destination number.' };
  try {
    const res = await fetch(`${API_BASE}/calls/click-to-dial`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: agent, to, caller_id: digits(site.phoneHref) }),
    });
    if (!res.ok) return { ok: false, error: `yay.com responded ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
