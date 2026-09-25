import 'server-only';
import { getSecret } from '@/lib/secrets';

// SMS sending — inert until a provider is configured. Designed for Twilio
// (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM) but provider-agnostic.
// Credentials resolve from owner-managed values first, then hosting env.
// Returns a safe result when not configured, so callers never break.

export async function smsConfigured(): Promise<boolean> {
  return Boolean((await getSecret('TWILIO_ACCOUNT_SID')) && (await getSecret('TWILIO_AUTH_TOKEN')) && (await getSecret('TWILIO_FROM')));
}

/** Read-only provider health check (BLD-668): confirms the Twilio credentials are
 *  present AND valid — i.e. the account is reachable and active — WITHOUT sending
 *  a message. Lets staff verify SMS is wired up before relying on it. */
export async function smsProviderStatus(): Promise<{ configured: boolean; valid: boolean; accountStatus?: string; from?: string; error?: string }> {
  const sid = await getSecret('TWILIO_ACCOUNT_SID');
  const authToken = await getSecret('TWILIO_AUTH_TOKEN');
  const from = await getSecret('TWILIO_FROM');
  const configured = Boolean(sid && authToken && from);
  const maskedFrom = from ? `${from.slice(0, 3)}…${from.slice(-4)}` : undefined;
  if (!configured) return { configured: false, valid: false, from: maskedFrom };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString('base64')}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { configured, valid: false, from: maskedFrom, error: `Twilio responded ${res.status}` };
    const data = (await res.json()) as { status?: string };
    return { configured, valid: true, accountStatus: data.status, from: maskedFrom };
  } catch {
    return { configured, valid: false, from: maskedFrom, error: 'Could not reach Twilio.' };
  }
}

export async function sendSms(to: string | null | undefined, body: string): Promise<{ ok: boolean; id?: string; error?: string; dummy?: boolean }> {
  if (!to) return { ok: false, error: 'No phone number on file.' };
  const sid = await getSecret('TWILIO_ACCOUNT_SID');
  const authToken = await getSecret('TWILIO_AUTH_TOKEN');
  const from = await getSecret('TWILIO_FROM');
  if (!sid || !authToken || !from) {
    // Dummy mode — Twilio isn't configured, so nothing is actually sent. Warn (not
    // log) so it's visible that a text was dropped, and flag dummy:true on the
    // result so callers/monitoring can tell this apart from a real send (BLD-583).
    console.warn(`[sms:dummy] Twilio not configured — text NOT sent → ${to}: ${body.slice(0, 80)}…`);
    return { ok: true, dummy: true, id: 'dummy-sms' };
  }
  // BLD-1038: mirror sendEmail's retry/backoff (lib/email.ts) — a transient
  // Twilio 429/5xx or timeout used to fail the send outright with nothing
  // logged, so a reminder or confirmation text silently vanished with no trace.
  // Retry a bounded few times with backoff on transient failures, and log
  // every failed attempt so a real outage is visible instead of one swallowed
  // error. A 4xx (bad number, unverified region, etc.) won't succeed on retry,
  // so it fails fast.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // Never put a full client number in the logs (same rule as BLD-1179) — the
  // last 4 digits are enough to correlate an outage with a specific send.
  const masked = `…${to.slice(-4)}`;
  let lastError = 'SMS send failed';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        lastError = `SMS provider ${res.status}`;
        console.error(`[sms] send attempt ${attempt + 1}/3 failed (${lastError}) → ${masked}`);
        if ((res.status === 429 || res.status >= 500) && attempt < 2) { await sleep(700 * (attempt + 1)); continue; }
        return { ok: false, error: lastError };
      }
      const data = (await res.json()) as { sid?: string };
      return { ok: true, id: data.sid };
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Could not reach SMS provider.';
      console.error(`[sms] send attempt ${attempt + 1}/3 failed (${lastError}) → ${masked}`);
      if (attempt < 2) { await sleep(700 * (attempt + 1)); continue; }
    }
  }
  return { ok: false, error: lastError };
}
