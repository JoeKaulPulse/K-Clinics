import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan, sessionPermissions } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ForumModeration } from '@/components/admin/ForumModeration';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

// BLD-533: community forum moderation hub.
export default async function AdminAcademyCommunityPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');

  const { adminListThreads, FORUM_CATEGORIES } = await import('@/lib/forum');
  const threads = await adminListThreads();
  const categories = FORUM_CATEGORIES.map((c) => ({ key: c.key, label: c.label }));

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <Link href="/admin/academy" className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">← K Academy</Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Community</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">The trainee community forum. Pin important threads, lock ones that should stop, hide or delete anything inappropriate, and reply as K Academy. Trainees see this in the portal’s <strong>Community</strong> tab. Hidden threads and posts are removed from their view.</p>
      <div className="mt-8">
        <ForumModeration threads={threads} categories={categories} />
      </div>
    </AdminShell>
  );
}
