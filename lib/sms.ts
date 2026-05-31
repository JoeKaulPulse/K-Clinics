import 'server-only';

// SMS sending — inert until a provider is configured. Designed for Twilio
// (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM) but provider-agnostic.
// Returns a safe result when not configured, so callers never break.

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendSms(to: string | null | undefined, body: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!to) return { ok: false, error: 'No phone number on file.' };
  if (!smsConfigured()) {
    // Dummy mode — log intent, pretend success so the flow can be exercised.
    console.log(`[sms:dummy] → ${to}: ${body.slice(0, 80)}…`);
    return { ok: true, id: 'dummy-sms' };
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, error: `SMS provider ${res.status}` };
    const data = (await res.json()) as { sid?: string };
    return { ok: true, id: data.sid };
  } catch {
    return { ok: false, error: 'Could not reach SMS provider.' };
  }
}
