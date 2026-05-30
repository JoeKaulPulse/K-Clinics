import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const token = new URL(req.url).searchParams.get('t');
  if (!token) return new NextResponse('Invalid link', { status: 400 });

  const { db } = await import('@/lib/db');
  const client = await db.client.findUnique({ where: { unsubToken: token } });
  if (client) {
    await db.client.update({ where: { id: client.id }, data: { unsubscribed: true, marketingOptIn: false } });
  }

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribed — K Clinics</title></head>
     <body style="font-family:Georgia,serif;background:#f6ece3;color:#2a2420;display:grid;place-items:center;height:100vh;margin:0;text-align:center;">
       <div><h1 style="letter-spacing:4px;">K CLINICS</h1><p>You have been unsubscribed from marketing emails.<br>We're sorry to see you go.</p></div>
     </body></html>`,
    { headers: { 'content-type': 'text/html' } },
  );
}
