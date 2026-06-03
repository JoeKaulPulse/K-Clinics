import { redirect, notFound } from 'next/navigation';
import { getSession, sessionCan } from '@/lib/auth';
import { getPageForEdit } from '@/lib/pages';
import { SectionRenderer } from '@/components/cms/SectionRenderer';

export const dynamic = 'force-dynamic';

// Admin-only draft preview, rendered with the live header/footer chrome so it
// looks exactly like the published page will.
export default async function PagePreview({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin/login');
  const { id } = await params;
  const page = await getPageForEdit(id);
  if (!page) notFound();
  const { resolveSections } = await import('@/lib/global-sections');
  const sections = await resolveSections(page.draft);

  return (
    <>
      <div className="sticky top-[var(--ann-h,0px)] z-[55] bg-[var(--color-gold)] py-1.5 text-center text-xs font-medium text-[var(--color-ink)]">
        Preview · {page.path} · draft {page.status === 'PUBLISHED' ? '(a published version is live)' : '(not published)'}
      </div>
      <SectionRenderer sections={sections} />
    </>
  );
}
