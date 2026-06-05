import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// Manual cache purge for the owner. Revalidates Next.js's full-route + data cache
// for every page under the root layout — i.e. the whole public site and admin —
// so price, content and offer changes show immediately instead of waiting for the
// hourly ISR window. Each page rebuilds on its next visit.
//
// Note: this clears the application (ISR/data) cache, which is what serves stale
// prices/content — it does not need a Vercel API token. A new production deploy
// already does the same; this gives the owner the same control on demand.
// Requires settings.manage (owner/admin/manager).
export async function POST() {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });

  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('settings.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  // Revalidate everything under the root layout (the entire site).
  revalidatePath('/', 'layout');

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'SETTINGS_UPDATED',
    actor: session.email,
    actorRole: session.role,
    summary: 'Purged the site cache (manual refresh of all pages)',
  });

  return NextResponse.json({ ok: true, purgedAt: new Date().toISOString() });
}
