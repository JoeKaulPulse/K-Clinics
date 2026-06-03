import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './db';
import { asSections, type Section } from './sections';

// Data layer for CMS pages. Public render reads the *published* sections via a
// tagged cache (so editorial routes stay static and refresh on publish).

export const PAGES_TAG = 'cms-pages';
const normPath = (p: string) => '/' + String(p || '').trim().replace(/^\/+|\/+$/g, '');

async function loadPublished(path: string): Promise<Section[] | null> {
  try {
    const row = await db.page.findUnique({ where: { path: normPath(path) }, select: { published: true, status: true } });
    if (!row || row.status !== 'PUBLISHED' || !row.published) return null;
    const sections = asSections(row.published);
    return sections.length ? sections : null;
  } catch { return null; }
}

/** Published sections for a route, or null to fall back to the coded page. */
export function getPublishedPage(path: string) {
  return unstable_cache(() => loadPublished(path), ['cms-page', normPath(path)], { tags: [PAGES_TAG], revalidate: 3600 })();
}

export async function listPages() {
  try {
    return await db.page.findMany({ orderBy: { updatedAt: 'desc' }, select: { id: true, path: true, title: true, status: true, updatedAt: true } });
  } catch { return []; }
}

export async function getPageForEdit(id: string) {
  try {
    const p = await db.page.findUnique({ where: { id } });
    if (!p) return null;
    return {
      id: p.id, path: p.path, title: p.title ?? '', status: p.status as 'DRAFT' | 'PUBLISHED',
      draft: asSections(p.draft), hasPublished: !!p.published,
    };
  } catch { return null; }
}

/** Derive a sensible <title>/description for a CMS page from its sections. */
export function pageMetaFromSections(sections: Section[]): { title: string; description: string } {
  const hero = sections.find((s) => s.type === 'hero');
  const heading = sections.find((s) => s.type === 'heading' || s.type === 'imageText' || s.type === 'featureGrid');
  const title = String((hero?.data?.title as string) || (heading?.data?.heading as string) || '').trim();
  const desc = String((hero?.data?.lede as string) || (heading?.data?.intro as string) || (heading?.data?.body as string) || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return { title, description: desc };
}

/** Slugs (single-segment) of published CMS pages, for static generation. */
export async function publishedTopLevelSlugs(): Promise<string[]> {
  try {
    const rows = await db.page.findMany({ where: { status: 'PUBLISHED' }, select: { path: true } });
    return rows.map((r) => r.path).filter((p) => /^\/[a-z0-9-]+$/.test(p)).map((p) => p.slice(1));
  } catch { return []; }
}

export async function pageRevisions(pageId: string) {
  try {
    const revs = await db.pageRevision.findMany({ where: { pageId }, orderBy: { createdAt: 'desc' }, take: 15, select: { id: true, label: true, createdAt: true, createdBy: true } });
    return revs.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  } catch { return []; }
}
