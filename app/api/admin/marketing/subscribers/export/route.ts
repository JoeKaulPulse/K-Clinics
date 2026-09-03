import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CSV export of the newsletter audience (website footer + dentistry waitlist +
// any other source that writes a NewsletterSubscriber). Respects the same
// status/source/search filters as the on-screen list so what you download
// matches what you see. Gated on campaigns.view — the marketing audience.
export async function GET(req: Request) {
  if (!crmEnabled) return new Response('Unavailable', { status: 503 });
  const { getSession, sessionCan } = await import('@/lib/auth');
  const session = await getSession();
  if (!sessionCan(session, 'campaigns.view')) return new Response('Forbidden', { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'active';
  const source = url.searchParams.get('source') || '';
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  const where: Record<string, unknown> = {};
  if (status === 'active') where.active = true;
  else if (status === 'unsubscribed') where.active = false;
  if (source) where.source = source;
  if (q) where.email = { contains: q, mode: 'insensitive' };

  const { db } = await import('@/lib/db');
  const rows = await db.newsletterSubscriber.findMany({
    where,
    orderBy: { consentedAt: 'desc' },
    select: { email: true, source: true, active: true, consentedAt: true, createdAt: true },
  });

  // BLD-1596: guard against CSV/formula injection. The public unauthenticated
  // POST /api/newsletter accepts any zod-.email()-valid address, and a
  // leading =, +, -, @ in the local-part passes that validator — Excel/Sheets
  // then evaluate the cell as a formula when a staff member opens the export.
  // Prefixing with a single leading apostrophe forces those clients to treat
  // the value as text (standard CSV-injection mitigation), before the
  // existing quote/comma/newline escaping runs.
  const esc = (v: string) => {
    const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };
  const iso = (d: Date) => new Date(d).toISOString();
  const header = ['email', 'source', 'status', 'consented_at', 'created_at'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      esc(r.email),
      esc(r.source ?? ''),
      r.active ? 'subscribed' : 'unsubscribed',
      iso(r.consentedAt),
      iso(r.createdAt),
    ].join(','));
  }
  const csv = lines.join('\n') + '\n';

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'DATA_EXPORTED',
    actor: session!.email,
    actorRole: session!.role,
    summary: `Newsletter subscribers exported (${rows.length} rows, status=${status}${source ? `, source=${source}` : ''})`,
  }).catch(() => {});

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="newsletter-subscribers-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
