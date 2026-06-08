import { getArticle, articleSlugs } from '@/lib/articles';
import { renderOg, ogSize, ogContentType } from '@/lib/og';
import { articleImage } from '@/lib/treatment-images';

export const dynamic = 'force-static';
export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'KClinics Journal article';

export function generateStaticParams() {
  return articleSlugs.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getArticle(slug);
  return renderOg({ eyebrow: `The Journal · ${a?.category ?? ''}`, title: a?.title ?? 'The Journal', accent: 'expert guidance', image: articleImage(slug) });
}
