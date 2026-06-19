import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { CartLink } from '@/components/shop/CartLink';
import { activeProducts, formatPence } from '@/lib/shop';
import { crmEnabled } from '@/lib/crm';
import { pageMeta } from '@/lib/seo';

export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Shop — Skincare & Products | KClinics',
  description: 'Shop clinic-grade skincare and products from KClinics, delivered to your door or collect in clinic.',
  path: '/shop',
});

export default async function ShopPage() {
  let products: Awaited<ReturnType<typeof activeProducts>> = [];
  if (crmEnabled) { try { products = await activeProducts(); } catch { /* none */ } }

  return (
    <>
      <PageHero eyebrow="Shop" title="Clinic-grade products" lede="Curated skincare and essentials — delivered to your door or collect in clinic.">
        <div className="mt-5 flex justify-center"><CartLink /></div>
      </PageHero>
      <section className="container-lux section">
        {products.length === 0 ? (
          <p className="text-center text-[var(--color-stone)]">Our shop is coming soon — check back shortly.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.04}>
                <Link href={`/shop/${p.slug}`} className="group block overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] transition-colors hover:border-[var(--color-gold)]">
                  <div className="aspect-square overflow-hidden bg-[var(--color-bone)]">
                    {p.images[0]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      : <span className="grid h-full place-items-center text-4xl text-[var(--color-stone)]">▦</span>}
                  </div>
                  <div className="p-5">
                    {p.brand && <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]">{p.brand}</p>}
                    <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg leading-tight group-hover:text-[var(--color-gold)]">{p.name}{p.ageRestricted && <span className="ml-2 align-middle rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[0.6rem] text-[var(--color-porcelain)]">18+</span>}</h2>
                    <p className="mt-2 font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">
                      {formatPence(p.pricePence)}
                      {p.compareAtPence && p.compareAtPence > p.pricePence ? <span className="ml-2 text-sm text-[var(--color-stone)] line-through">{formatPence(p.compareAtPence)}</span> : null}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
