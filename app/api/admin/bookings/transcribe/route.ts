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

  const contentType = req.headers.get('content-type') || 'audio/webm';
  const audio = await req.arrayBuffer().catch(() => null);
  if (!audio || audio.byteLength < 100) {
    return NextResponse.json({ ok: false, error: 'No audio received.' }, { status: 400 });
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
    const detail = await dgRes.text().catch(() => '');
    return NextResponse.json({ ok: false, error: `Transcription failed (${dgRes.status}). ${detail}`.trim() }, { status: 502 });
  }

  const json = await dgRes.json().catch(() => null);
  const transcript: string = json?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  if (!transcript) return NextResponse.json({ ok: false, error: 'No speech detected — try speaking closer to the microphone.' });

  return NextResponse.json({ ok: true, transcript });
}
