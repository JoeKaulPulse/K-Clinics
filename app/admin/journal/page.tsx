import Link from 'next/link';
import { redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function AdminJournalPage() {
  if (!crmEnabled) return <CrmDisabled />;
  const session = await getSession();
  if (!sessionCan(session, 'settings.manage')) redirect('/admin');
  const { listAllPosts } = await import('@/lib/blog');
  let posts: Awaited<ReturnType<typeof listAllPosts>> = [];
  let tableMissing = false;
  try { posts = await listAllPosts(); } catch { tableMissing = true; }

  const can = await sessionPermissions();
  const locale = await getLocale();
  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const rowCls = 'grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--color-line)] px-5 py-3 last:border-0 sm:grid-cols-[2fr_1fr_0.8fr_auto] sm:items-center';

  return (
    <AdminShell user={session?.email} can={can} locale={locale}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Journal</h1>
          <p className="mt-1 text-sm text-[var(--color-stone)]">{posts.length} {posts.length === 1 ? 'post' : 'posts'} · published posts appear on <Link href="/journal" className="text-[var(--color-gold)] hover:underline">/journal</Link></p>
        </div>
        <Link href="/admin/journal/new" className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)]">+ New post</Link>
      </div>

      {tableMissing && (
        <p className="mt-5 rounded-[var(--radius-md)] border border-[color-mix(in_oklab,#d9a441_45%,transparent)] bg-[var(--color-bone)] p-4 text-sm">
          The <code>Post</code> table isn’t in the database yet. Run <code>npm run db:push</code> (or <code>npx prisma db push</code>) then re-run the blog import.
        </p>
      )}

      <div className="mt-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
        <div className={`${rowCls} bg-[var(--color-bone)] text-xs uppercase tracking-[0.12em] text-[var(--color-stone)]`}>
          <span>Title</span>
          <span className="hidden sm:block">Category</span>
          <span className="hidden sm:block">Updated</span>
          <span className="justify-self-end">Status</span>
        </div>
        {posts.length === 0 && !tableMissing && <p className="p-6 text-sm text-[var(--color-stone)]">No posts yet. Click “New post”, or run the blog import to bring across your old articles.</p>}
        {posts.map((p) => (
          <Link key={p.id} href={`/admin/journal/${p.id}`} className={`${rowCls} hover:bg-[var(--color-bone)]`}>
            <span className="font-medium">{p.title}</span>
            <span className="hidden text-sm text-[var(--color-stone)] sm:block">{p.category ?? '—'}</span>
            <span className="hidden text-sm text-[var(--color-stone)] sm:block">{fmt(p.updatedAt)}</span>
            <span className={`justify-self-end rounded-full px-3 py-1 text-xs ${p.status === 'PUBLISHED' ? 'bg-[color-mix(in_oklab,var(--color-jade)_22%,transparent)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>{p.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
