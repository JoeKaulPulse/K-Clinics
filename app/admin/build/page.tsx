import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions, sessionIsAdmin } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { BuildBoard } from '@/components/admin/BuildBoard';
import { githubConfigured, ensureBacklogSeeded } from '@/lib/build-board';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function BuildPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'build.view')) redirect('/admin');

  const can = await sessionPermissions();
  const locale = await getLocale();
  const canManage = sessionCan(session, 'build.manage');
  const isAdmin = sessionIsAdmin(session);

  // First board view after a deploy auto-imports the backlog (version-gated,
  // idempotent) — no manual "Import" click needed, and no build-time DB writes.
  await ensureBacklogSeeded();

  let staff: { email: string; name: string | null }[] = [];
  try {
    const { db } = await import('@/lib/db');
    staff = await db.adminUser.findMany({ where: { active: true }, select: { email: true, name: true }, orderBy: { name: 'asc' } });
  } catch { /* best-effort */ }

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Build &amp; issues</h1>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-stone)]">
        Live work tracker — problems reported by the team, tasks, reviews and audits, triaged across the board and allocated to
        Claude or staff. Use <strong>Report a problem</strong> (bottom-right, on any page) to log something with a screenshot.
      </p>
      <div className="mt-6">
        <BuildBoard canManage={canManage} isAdmin={isAdmin} github={await githubConfigured()} staff={staff} me={session?.email || ''} />
      </div>
    </AdminShell>
  );
}
