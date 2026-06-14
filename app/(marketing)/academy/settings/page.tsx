import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { AcademySettings } from '@/components/academy/AcademySettings';
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
    <section className="container-lux py-[calc(var(--header-h,5.25rem)+2rem)]">
      <Link href="/academy/portal" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← Trainee portal</Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl">Settings</h1>
      <p className="mt-2 max-w-xl text-[var(--color-stone)]">Sound and sign-in preferences for your academy.</p>
      <AcademySettings passkeys={passkeys.map((p) => ({ id: p.id, name: p.deviceName ?? 'Passkey', createdAt: p.createdAt.toISOString(), lastUsedAt: p.lastUsedAt?.toISOString() ?? null }))} />
    </section>
  );
}
