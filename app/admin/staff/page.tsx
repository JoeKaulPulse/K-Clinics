import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { effectivePermissions } from '@/lib/permissions';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { StaffManager } from '@/components/admin/StaffManager';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'staff.view')) redirect('/admin');

  const { db } = await import('@/lib/db');
  const rows = await db.adminUser.findMany({ orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] });
  const staff = rows.map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    role: s.role,
    active: s.active,
    permGrant: s.permGrant ?? [],
    permRevoke: s.permRevoke ?? [],
    lastLoginAt: s.lastLoginAt ? s.lastLoginAt.toISOString() : null,
  }));

  const can = session ? [...effectivePermissions({ role: session.role, permGrant: session.grant, permRevoke: session.revoke })] : [];
  const locale = await getLocale();

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <StaffManager staff={staff} canManage={sessionCan(session, 'staff.manage')} actorRole={session?.role ?? 'STAFF'} />
    </AdminShell>
  );
}
