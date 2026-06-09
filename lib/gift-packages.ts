import 'server-only';
import { db } from '@/lib/db';
import { packages } from '@/lib/packages';

// Gifts live under Products as two categories, so they group cleanly in admin and
// can later surface in a public "Gifts" section.
export const GIFT_CARD_CATEGORY = 'Gift card';
export const GIFT_PACKAGE_CATEGORY = 'Gift package';
export const GIFT_CATEGORIES = [GIFT_CARD_CATEGORY, GIFT_PACKAGE_CATEGORY];

const giftSlug = (slug: string) => `gift-${slug}`;

export type GiftablePackage = { slug: string; name: string; description: string | null; pricePence: number; images: string[] };

/** Published, priced gift packages for the public Gifts section. Excludes drafts
 *  and £0 (unpriced) packages so nothing half-set-up can be bought. Never throws. */
export async function listPublishedGiftPackages(): Promise<GiftablePackage[]> {
  try {
    const rows = await db.product.findMany({
      where: { category: GIFT_PACKAGE_CATEGORY, status: 'ACTIVE', pricePence: { gt: 0 } },
      select: { slug: true, name: true, description: true, pricePence: true, images: true },
      orderBy: { pricePence: 'asc' },
    });
    return rows;
  } catch { return []; }
}

/** Resolve one buyable gift package by slug (published + priced), or null. */
export async function getPublishedGiftPackage(slug: string): Promise<GiftablePackage | null> {
  try {
    const p = await db.product.findFirst({
      where: { slug, category: GIFT_PACKAGE_CATEGORY, status: 'ACTIVE', pricePence: { gt: 0 } },
      select: { slug: true, name: true, description: true, pricePence: true, images: true },
    });
    return p;
  } catch { return null; }
}

/** Turn the clinic's curated treatment packages into DRAFT gift products for the
 *  owner to review, price and publish. Idempotent — skips ones already created
 *  (matched by slug). Nothing goes live: every draft stays DRAFT until published. */
export async function seedGiftablePackageDrafts(actor: string): Promise<{ created: number; skipped: number }> {
  let created = 0, skipped = 0;
  for (const p of packages) {
    const slug = giftSlug(p.slug);
    const exists = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (exists) { skipped += 1; continue; }
    const description = [
      p.description,
      '',
      'Included:',
      ...p.includes.map((i) => `• ${i}`),
      '',
      `Best for: ${p.bestFor}`,
      '',
      'Giftable package draft — set a gift price and publish to offer it as a gift.',
    ].join('\n');
    await db.product.create({
      data: {
        slug,
        name: `${p.name} — gift package`,
        description: description.slice(0, 4000),
        category: GIFT_PACKAGE_CATEGORY,
        status: 'DRAFT',          // never auto-published
        trackInventory: false,    // a gift package isn't stock-limited
        pricePence: 0,            // owner sets the gift price on review
        createdBy: actor,
      },
    });
    created += 1;
  }
  return { created, skipped };
}
