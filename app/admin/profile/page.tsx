import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ProfileEditor } from '@/components/admin/ProfileEditor';
import { ROLES } from '@/lib/permissions';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { db } = await import('@/lib/db');
  const me = await db.adminUser.findUnique({
    where: { id: session.sub },
    select: { name: true, title: true, email: true, role: true, isClinician: true, lastLoginAt: true },
  });
  if (!me) redirect('/admin/login');

  const roleLabel = ROLES.find((r) => r.value === me.role)?.label || me.role;
  const can = await sessionPermissions();
  const locale = await getLocale();
  const uk = locale === 'uk';

  return (
    <AdminShell user={session.email} can={can} locale={locale}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">{uk ? 'Мій профіль' : 'My profile'}</h1>
      <p className="mt-1 text-sm text-[var(--color-stone)]">
        {me.email} · {roleLabel}{me.isClinician ? (uk ? ' · клініцист' : ' · clinician') : ''}
        {me.lastLoginAt ? ` · ${uk ? 'останній вхід' : 'last login'} ${new Date(me.lastLoginAt).toLocaleString('en-GB')}` : ''}
      </p>
      <div className="mt-8 max-w-xl">
        <ProfileEditor name={me.name} title={me.title} uk={uk} />
      </div>
    </AdminShell>
  );
}
