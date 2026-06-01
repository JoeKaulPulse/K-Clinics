import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { db } = await import('@/lib/db');

  if (body.op === 'save') {
    const path = String(body.path || '').trim();
    if (!path.startsWith('/')) return NextResponse.json({ ok: false, error: 'Invalid path.' }, { status: 400 });
    const data = {
      title: (body.title as string)?.trim() || null,
      description: (body.description as string)?.trim() || null,
      canonical: (body.canonical as string)?.trim() || null,
      focusKeyword: (body.focusKeyword as string)?.trim() || null,
      ogImage: (body.ogImage as string)?.trim() || null,
      noindex: !!body.noindex,
      updatedBy: session.email,
    };
    await db.pageSeo.upsert({ where: { path }, update: data, create: { path, ...data } });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'clear') {
    if (!body.path) return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
    await db.pageSeo.deleteMany({ where: { path: String(body.path) } });
    return NextResponse.json({ ok: true });
  }

  if (body.op === 'aiSuggest') {
    const { title, description, path, focusKeyword, issues } = body as { title?: string; description?: string; path?: string; focusKeyword?: string; issues?: string[] };
    const suggestion = await aiSuggest({ title, description, path, focusKeyword, issues });
    return NextResponse.json({ ok: true, ...suggestion });
  }

  return NextResponse.json({ ok: false, error: 'Unknown op' }, { status: 400 });
}

// AI suggestions via the Claude API. Degrades gracefully (rules-based draft) when
// ANTHROPIC_API_KEY is absent or the call fails — the feature never hard-errors.
async function aiSuggest(input: { title?: string; description?: string; path?: string; focusKeyword?: string; issues?: string[] }) {
  const key = process.env.ANTHROPIC_API_KEY;
  const brand = 'K Clinics (aesthetics & dentistry, Islington, London)';
  if (!key) {
    return {
      ai: false,
      title: (input.title || '').slice(0, 60),
      description: (input.description || '').slice(0, 158),
      recommendations: [
        'Add ANTHROPIC_API_KEY to enable AI rewrites.',
        'Keep titles 30–60 chars with the focus keyword near the front.',
        'Write a 70–160 char answer-first description including the location (Islington/London).',
        'Add FAQ Q&A and Service/LocalBusiness JSON-LD for AI answer engines.',
      ],
    };
  }
  try {
    const prompt = `You are an SEO/GEO specialist for ${brand}. Improve the SEO for the page "${input.path}".\nCurrent title: ${input.title || '(none)'}\nCurrent description: ${input.description || '(none)'}\nFocus keyword: ${input.focusKeyword || '(none)'}\nKnown issues: ${(input.issues || []).join('; ') || '(none)'}\n\nReturn STRICT JSON only: {"title": "<=60 chars, keyword-led, includes London/Islington where natural", "description": "70-160 chars, answer-first, compelling, includes location", "focusKeyword": "primary keyword", "recommendations": ["3-5 short, specific actions to improve on-page, structured-data, AI-answer readiness and local SEO"]}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const j = await res.json();
    const text = j?.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return { ai: true, title: parsed.title, description: parsed.description, focusKeyword: parsed.focusKeyword, recommendations: parsed.recommendations ?? [] };
  } catch (e) {
    return { ai: false, error: (e as Error).message, recommendations: ['AI suggestion failed — check ANTHROPIC_API_KEY and network. Falling back to rules-based guidance.'] };
  }
}
