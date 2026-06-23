import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { AddToCart } from '@/components/shop/AddToCart';
import { CartLink } from '@/components/shop/CartLink';
import { getProductBySlug, formatPence } from '@/lib/shop';
import { crmEnabled } from '@/lib/crm';
import { pageMeta, JsonLd, productLd, breadcrumbLd } from '@/lib/seo';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = crmEnabled ? await getProductBySlug(slug).catch(() => null) : null;
  return pageMeta({ title: p ? `${p.name} | KClinics Shop` : 'Shop | KClinics', description: p?.description?.slice(0, 155) || 'Shop clinic-grade products at KClinics.', path: `/shop/${slug}` });
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!crmEnabled) notFound();
  const { slug } = await params;
  const p = await getProductBySlug(slug).catch(() => null);
  if (!p) notFound();
  const onSale = p.compareAtPence && p.compareAtPence > p.pricePence;
  const inStock = !(p.trackInventory && p.stockQty <= 0);

  return (
    <>
      <JsonLd
        data={[
          productLd({ name: p.name, slug: p.slug, description: p.description, brand: p.brand, images: p.images, pricePence: p.pricePence, inStock }),
          breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: p.name, path: `/shop/${p.slug}` }]),
        ]}
      />
      <section className="container-lux section pt-[calc(var(--header-h,5.25rem)+2rem)]">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/shop" className="text-sm text-[var(--color-stone)] hover:underline">← Shop</Link>
        <CartLink />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)]">
          {p.images[0]
            ? <Image src={p.images[0]} alt={p.name} width={800} height={800} sizes="(max-width: 1024px) 100vw, 50vw" className="aspect-square w-full object-cover" priority />
            : <span className="grid aspect-square place-items-center text-5xl text-[var(--color-stone)]">▦</span>}
          {p.images.length > 1 && (
            <div className="flex gap-2 p-3">
              {p.images.slice(1, 5).map((u, i) => (
                <Image key={i} src={u} alt="" width={64} height={64} className="h-16 w-16 rounded object-cover" />
              ))}
            </div>
          )}
        </div>
        <div>
          {p.brand && <p className="eyebrow">{p.brand}</p>}
          <h1 className="text-title mt-1">{p.name}</h1>
          <p className="mt-4 font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">
            {formatPence(p.pricePence)}
            {onSale ? <span className="ml-3 text-lg text-[var(--color-stone)] line-through">{formatPence(p.compareAtPence!)}</span> : null}
          </p>
          {p.description && <p className="mt-5 whitespace-pre-line leading-relaxed text-[var(--color-stone)]">{p.description}</p>}
          {p.ageRestricted && <p className="mt-4 inline-block rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs text-[var(--color-porcelain)]">Age-restricted — 18+ verification required at checkout</p>}
          <div className="mt-7">
            <AddToCart product={{ productId: p.id, slug: p.slug, name: p.name, image: p.images[0] ?? null, pricePence: p.pricePence, ageRestricted: p.ageRestricted }} outOfStock={p.trackInventory && p.stockQty <= 0} />
          </div>
        </div>
      </div>
      </section>
    </>
  );
}
