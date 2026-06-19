import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GIF search for the chat composer. Proxies Tenor (preferred) or GIPHY when a key
// is configured; otherwise reports `configured:false` so the picker shows a tidy
// "add a TENOR_API_KEY / GIPHY_API_KEY" note instead of breaking. The proxy keeps
// the provider key server-side and normalises both providers to one shape.

type Gif = { id: string; url: string; preview: string; width: number; height: number; title: string };

type TenorFormat = { url?: string; dims?: number[] };
type TenorResult = { id?: string; content_description?: string; media_formats?: Record<string, TenorFormat> };

async function tenor(q: string, key: string): Promise<Gif[]> {
  const base = q.trim()
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}`
    : 'https://tenor.googleapis.com/v2/featured?';
  const url = `${base}&key=${key}&client_key=kclinics&limit=24&media_filter=gif,tinygif&contentfilter=high`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const j = (await r.json()) as { results?: TenorResult[] };
  return (j.results || []).map((g): Gif => {
    const media = g.media_formats || {};
    const full = media.gif || media.tinygif || {};
    const small = media.tinygif || media.gif || {};
    return { id: String(g.id || ''), url: full.url || '', preview: small.url || '', width: full.dims?.[0] || 0, height: full.dims?.[1] || 0, title: g.content_description || 'GIF' };
  }).filter((g) => g.url && g.preview);
}

type GiphyImg = { url?: string; width?: string; height?: string };
type GiphyResult = { id?: string; title?: string; images?: Record<string, GiphyImg> };

async function giphy(q: string, key: string): Promise<Gif[]> {
  const endpoint = q.trim() ? 'search' : 'trending';
  const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${key}&limit=24&rating=pg-13${q.trim() ? `&q=${encodeURIComponent(q)}` : ''}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const j = (await r.json()) as { data?: GiphyResult[] };
  return (j.data || []).map((g): Gif => {
    const img = g.images || {};
    const full = img.downsized_medium || img.original || {};
    const small = img.fixed_width_small || img.preview_gif || full;
    return { id: String(g.id || ''), url: full.url || '', preview: small.url || '', width: Number(full.width) || 0, height: Number(full.height) || 0, title: g.title || 'GIF' };
  }).filter((g) => g.url && g.preview);
}

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getSession } = await import('@/lib/auth');
  if (!(await getSession())) return NextResponse.json({ ok: false }, { status: 401 });

  const tenorKey = process.env.TENOR_API_KEY;
  const giphyKey = process.env.GIPHY_API_KEY;
  if (!tenorKey && !giphyKey) return NextResponse.json({ ok: true, configured: false, gifs: [] });

  const q = new URL(req.url).searchParams.get('q') || '';
  try {
    const gifs = tenorKey ? await tenor(q, tenorKey) : await giphy(q, giphyKey!);
    return NextResponse.json({ ok: true, configured: true, gifs });
  } catch {
    return NextResponse.json({ ok: true, configured: true, gifs: [] });
  }
}
