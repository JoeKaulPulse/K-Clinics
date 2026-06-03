import { redirect, notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { PageBuilder } from '@/components/admin/PageBuilder';
import { getPageForEdit, pageRevisions } from '@/lib/pages';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { id } = await params;
  const page = await getPageForEdit(id);
  if (!page) notFound();
  const revisions = await pageRevisions(id);
  // Offer the page's original content if it was taken over empty.
  const { pageSeed } = await import('@/lib/page-seeds');
  const seed = page.draft.length ? null : pageSeed(page.path);
  // Current per-path SEO override (applied site-wide via pageMeta).
  let seo: { title: string; description: string; ogImage: string; noindex: boolean } = { title: '', description: '', ogImage: '', noindex: false };
  try {
    const { db } = await import('@/lib/db');
    const row = await db.pageSeo.findUnique({ where: { path: page.path }, select: { title: true, description: true, ogImage: true, noindex: true } });
    if (row) seo = { title: row.title ?? '', description: row.description ?? '', ogImage: row.ogImage ?? '', noindex: row.noindex };
  } catch { /* table optional */ }

  const { listGlobalSections } = await import('@/lib/global-sections');
  const reusables = (await listGlobalSections()).map((b) => ({ id: b.id, name: b.name, type: b.type }));

  const can = await sessionPermissions();
  const canPublish = sessionCan(session, 'content.publish');
  const locale = await getLocale();
  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <PageBuilder initial={page} revisions={revisions} seed={seed} seo={seo} reusables={reusables} canPublish={canPublish} />
    </AdminShell>
  );
}
