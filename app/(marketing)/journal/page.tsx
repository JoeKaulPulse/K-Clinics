import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { JournalBrowser } from '@/components/journal/JournalBrowser';
import { sortedArticles } from '@/lib/articles';
import { articleImage } from '@/lib/treatment-images';
import { pageMeta, JsonLd, breadcrumbLd, itemListLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'The Journal — Expert Skin, Laser & Dentistry Guides | KClinics London',
  description:
    'Expert guidance from KClinics, Islington — honest, practical articles on laser, skin, injectables and aesthetic dentistry to help you make confident, informed choices.',
  path: '/journal',
  keywords: ['aesthetics blog London', 'skincare advice', 'laser hair removal guide', 'aesthetic dentistry tips'],
});

export default function JournalPage() {
  const cards = sortedArticles.map((a) => ({
    slug: a.slug, title: a.title, excerpt: a.excerpt, category: a.category,
    readMinutes: a.readMinutes, published: a.published, image: articleImage(a.slug),
  }));

  return (
    <>
      <JsonLd data={[
        breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Journal', path: '/journal' }]),
        itemListLd('KClinics Journal articles', sortedArticles.map((a) => ({ name: a.title, path: `/journal/${a.slug}` }))),
      ]} />
      <PageHero
        eyebrow="The Journal"
        title="Considered guidance, beautifully clear."
        lede="Honest, expert advice on skin, laser, injectables and aesthetic dentistry — to help you make confident, informed decisions about your care."
        gradient={['#7b6a5d', '#2a2420']}
      />

      <section className="container-lux section">
        <JournalBrowser articles={cards} />
      </section>
    </>
  );
}
