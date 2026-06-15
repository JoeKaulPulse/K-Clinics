import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-138 — voice note transcription via Deepgram. Accepts raw audio from the
// clinician's browser (MediaRecorder output, typically webm/opus), returns the
// transcript for insertion into the clinical note textarea. Requires
// DEEPGRAM_API_KEY; returns 503 if not configured so the UI can fall back
// gracefully. Gated behind bookings.manage + clients.clinical.view.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Unavailable' }, { status: 503 });

  const { requirePermission } = await import('@/lib/auth');
  const sess = await requirePermission('bookings.manage');
  if (!sess) return NextResponse.json({ ok: false, error: 'Not permitted' }, { status: 403 });
  const { sessionCan } = await import('@/lib/auth');
  if (!sessionCan(sess, 'clients.clinical.view')) {
    return NextResponse.json({ ok: false, error: 'Clinical access required' }, { status: 403 });
  }

  const { getSecret } = await import('@/lib/secrets');
  const key = await getSecret('DEEPGRAM_API_KEY');
  if (!key) return NextResponse.json({ ok: false, error: 'Voice transcription is not configured — add a Deepgram API key under Admin > Credentials.' }, { status: 503 });

  // Only forward known audio container types; never let this become a generic
  // proxy to Deepgram with an arbitrary Content-Type. Defaults to webm (the
  // MediaRecorder output). Strip any codec/charset params before matching.
  const rawType = (req.headers.get('content-type') || 'audio/webm').split(';')[0].trim().toLowerCase();
  const ALLOWED_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/mpeg', 'audio/m4a', 'audio/aac']);
  const contentType = ALLOWED_TYPES.has(rawType) ? rawType : 'audio/webm';

  // Cap the upload (25 MB ~ a long clinical voice note) to bound memory and
  // avoid abusive/accidental large forwards to the paid Deepgram API.
  const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
  const declaredLen = Number(req.headers.get('content-length') || 0);
  if (declaredLen > MAX_AUDIO_BYTES) {
    return NextResponse.json({ ok: false, error: 'Recording too large.' }, { status: 413 });
  }
  const audio = await req.arrayBuffer().catch(() => null);
  if (!audio || audio.byteLength < 100) {
    return NextResponse.json({ ok: false, error: 'No audio received.' }, { status: 400 });
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ ok: false, error: 'Recording too large.' }, { status: 413 });
  }

  let dgRes: Response;
  try {
    dgRes = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&language=en-GB&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: { Authorization: `Token ${key}`, 'Content-Type': contentType },
        body: audio,
        signal: AbortSignal.timeout(45_000), // bound a hung upstream
      },
    );
  } catch (e) {
    const timedOut = (e as Error)?.name === 'TimeoutError';
    return NextResponse.json({ ok: false, error: timedOut ? 'Transcription timed out — please try a shorter recording.' : 'Could not reach the transcription service.' }, { status: 504 });
  }

  if (!dgRes.ok) {
    const detail = (await dgRes.text().catch(() => '')).slice(0, 200);
    return NextResponse.json({ ok: false, error: `Transcription failed (${dgRes.status}). ${detail}`.trim() }, { status: 502 });
  }

  const json = await dgRes.json().catch(() => null);
  const transcript: string = json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  if (!transcript) return NextResponse.json({ ok: false, error: 'No speech detected — try speaking closer to the microphone.' });

  // Structure the raw dictation into a clean clinical note via Claude (formatting
  // only — never adds, infers, diagnoses or recommends). Falls back to the raw
  // transcript when Claude isn't configured or the call fails, so transcription
  // always works on its own. The clinician reviews and edits before saving.
  const aiKey = await getSecret('ANTHROPIC_API_KEY');
  const structured = aiKey && transcript.length > 40 ? await tidyClinicalNote(transcript, aiKey).catch(() => null) : null;

  return NextResponse.json({ ok: true, transcript: structured || transcript, structured: Boolean(structured) });
}

// Claude (Haiku) reformats a dictation into a clean clinical note. Strictly
// formatting/organisation — the prompt forbids adding or inferring clinical
// content — so it stays clear of the medical-device line (it never interprets or
// recommends). Special-category data is already gated by clients.clinical.view,
// and Anthropic is an existing named processor for the clinical AI features.
async function tidyClinicalNote(transcript: string, key: string): Promise<string | null> {
  const system = [
    'You are a clinical scribe for an aesthetics & skin clinic. Reformat the practitioner’s dictated note into a clean, professional clinical record.',
    'RULES (strict):',
    '- Use ONLY information stated in the dictation. Never add, infer, diagnose, or recommend anything that was not explicitly said.',
    '- Correct grammar, punctuation, capitalisation and obvious mis-transcriptions of clinical or product names.',
    '- Organise into short labelled lines where the content supports it (e.g. Presentation, Treatment performed, Areas/products, Aftercare advised, Follow-up). Do not invent sections the dictation does not support.',
    '- Keep it concise and factual. Preserve any numbers, units, product names and doses exactly.',
    '- If the dictation is too short or unclear to structure, return it lightly cleaned.',
    'Output ONLY the note text — no preamble, no markdown code fences.',
  ].join('\n');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, system, messages: [{ role: 'user', content: transcript }] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text: string | undefined = j?.content?.find((c: { type: string }) => c.type === 'text')?.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
