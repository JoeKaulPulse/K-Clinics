import 'server-only';
import { db } from '@/lib/db';

export type PublicGalleryItem = {
  id: string;
  category: string;
  caption: string | null;
  treatmentSlug: string | null;
  beforeSrc: string;
  afterSrc: string;
};

/** Published, consented before/after cases for the public gallery. */
export async function getPublishedGallery(): Promise<PublicGalleryItem[]> {
  try {
    const rows = await db.galleryItem.findMany({
      where: { published: true, consent: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, category: true, caption: true, treatmentSlug: true, updatedAt: true },
    });
    return rows.map((r) => {
      const v = r.updatedAt.getTime();
      return {
        id: r.id, category: r.category, caption: r.caption, treatmentSlug: r.treatmentSlug,
        beforeSrc: `/api/gallery/${r.id}/before?v=${v}`,
        afterSrc: `/api/gallery/${r.id}/after?v=${v}`,
      };
    });
  } catch {
    return [];
  }
}
