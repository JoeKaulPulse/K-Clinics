import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// BLD-242 — double opt-in re-permission landing. The email links here (GET):
// we show a confirm button, and only an affirmative POST writes consent, so a
// mail-client link preview can never opt someone in. Self-contained HTML to
// match the existing /api/unsubscribe page.
function page(title: string, bodyHtml: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} — KClinics</title></head>
     <body style="font-family:Georgia,serif;background:#f6ece3;color:#2a2420;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px;">
       <div style="max-width:30rem;"><h1 style="letter-spacing:4px;font-size:20px;">K CLINICS</h1>${bodyHtml}</div>
     </body></html>`,
    { headers: { 'content-type': 'text/html' } },
  );
}

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const token = new URL(req.url).searchParams.get('t');
  if (!token) return page('Invalid link', '<p>This link is invalid or has expired.</p>');
  // A button that POSTs back to this same URL — the affirmative action.
  return page(
    'Confirm your preferences',
    `<p style="font-size:17px;margin:18px 0;">Confirm you'd like to keep receiving offers, news and skincare tips from KClinics.</p>
     <form method="post" action="/api/marketing/reconsent?t=${encodeURIComponent(token)}">
       <button type="submit" style="display:inline-block;background:#a98a6d;color:#fff;border:none;cursor:pointer;text-decoration:none;padding:14px 30px;border-radius:999px;font-size:15px;font-family:Helvetica,Arial,sans-serif;">Yes, keep me subscribed</button>
     </form>
     <p style="font-size:13px;color:#91766e;margin-top:20px;">If you'd rather not, simply close this page — no action is needed.</p>`,
  );
}

export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const token = new URL(req.url).searchParams.get('t');
  if (!token) return page('Invalid link', '<p>This link is invalid or has expired.</p>');
  const { recordReconsent } = await import('@/lib/re-permission');
  const r = await recordReconsent(token).catch(() => ({ ok: false as const }));
  if (!r.ok) return page('Something went wrong', '<p>We couldn’t update your preferences. Please try the link again, or contact us.</p>');
  return page(
    'You’re confirmed',
    `<p style="font-size:17px;margin:18px 0;">Thank you${'firstName' in r && r.firstName ? `, ${escapeHtml(r.firstName)}` : ''} — you’re all set.</p>
     <p style="color:#7b6a5d;">You’ll keep receiving our offers and news. You can change your mind anytime using the unsubscribe link in any email.</p>`,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
