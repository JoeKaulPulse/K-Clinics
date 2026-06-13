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

  const dgRes = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-3&language=en-GB&smart_format=true&punctuate=true',
    {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': contentType },
      body: audio,
    },
  ).catch((e) => { throw new Error(`Deepgram unreachable: ${(e as Error).message}`); });

  if (!dgRes.ok) {
    const detail = (await dgRes.text().catch(() => '')).slice(0, 200);
    return NextResponse.json({ ok: false, error: `Transcription failed (${dgRes.status}). ${detail}`.trim() }, { status: 502 });
  }

  const json = await dgRes.json().catch(() => null);
  const transcript: string = json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  if (!transcript) return NextResponse.json({ ok: false, error: 'No speech detected — try speaking closer to the microphone.' });

  return NextResponse.json({ ok: true, transcript });
}
