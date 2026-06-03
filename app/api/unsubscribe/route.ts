import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Suppress a client from all marketing by their unsubscribe token. */
async function suppress(token: string): Promise<boolean> {
  const { db } = await import('@/lib/db');
  const client = await db.client.findUnique({ where: { unsubToken: token }, select: { id: true } });
  if (!client) return false;
  await db.client.update({ where: { id: client.id }, data: { unsubscribed: true, marketingOptIn: false } });
  return true;
}

// Browser unsubscribe (the link in the email footer).
export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const token = new URL(req.url).searchParams.get('t');
  if (!token) return new NextResponse('Invalid link', { status: 400 });
  await suppress(token);

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribed — KClinics</title></head>
     <body style="font-family:Georgia,serif;background:#f6ece3;color:#2a2420;display:grid;place-items:center;height:100vh;margin:0;text-align:center;">
       <div><h1 style="letter-spacing:4px;">K CLINICS</h1><p>You have been unsubscribed from marketing emails.<br>We're sorry to see you go.</p></div>
     </body></html>`,
    { headers: { 'content-type': 'text/html' } },
  );
}

// RFC 8058 one-click unsubscribe — mail clients (Gmail/Yahoo) POST here when the
// recipient hits the native "Unsubscribe" button. Must return 200 quickly.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const token = new URL(req.url).searchParams.get('t');
  if (token) await suppress(token).catch(() => {});
  return new NextResponse(null, { status: 200 });
}
