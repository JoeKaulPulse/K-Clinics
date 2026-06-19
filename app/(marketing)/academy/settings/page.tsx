import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademySettings } from '@/components/academy/AcademySettings';
import { AcademyPortalShell } from '@/components/academy/AcademyPortalShell';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({ title: 'Settings — K Academy', description: 'Academy app settings.', path: '/academy/settings' });
export const dynamic = 'force-dynamic';

export default async function AcademySettingsPage() {
  if (!crmEnabled) redirect('/academy');
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) redirect('/academy/portal');

  const { db } = await import('@/lib/db');
  const passkeys = await db.studentPasskey.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' }, select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true } });

  return (
    <AcademyPortalShell firstName={student.firstName}>
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">Settings</h1>
      <p className="mt-2 max-w-xl text-[var(--color-stone)]">Sound and sign-in preferences for your academy.</p>
      <AcademySettings passkeys={passkeys.map((p) => ({ id: p.id, name: p.deviceName ?? 'Passkey', createdAt: p.createdAt.toISOString(), lastUsedAt: p.lastUsedAt?.toISOString() ?? null }))} />
    </AcademyPortalShell>
  );
}
