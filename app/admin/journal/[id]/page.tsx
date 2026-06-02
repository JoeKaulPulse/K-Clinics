import { redirect, notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PostEditor } from '@/components/admin/PostEditor';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { id } = await params;

  let initial = null;
  if (id !== 'new') {
    const { getPostById } = await import('@/lib/blog');
    const p = await getPostById(id);
    if (!p) notFound();
    initial = {
      id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', metaDescription: p.metaDescription ?? '',
      content: p.content, category: p.category ?? '', coverImage: p.coverImage ?? '', readMinutes: p.readMinutes,
      keywords: p.keywords.join(', '), related: p.related.join(', '), status: p.status,
    };
  }

  const can = await sessionPermissions();
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <PostEditor initial={initial} />
    </AdminShell>
  );
}
