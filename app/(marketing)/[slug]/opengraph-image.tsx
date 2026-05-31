import { getTreatment, treatmentSlugs } from '@/lib/treatments';
import { renderOg, ogSize, ogContentType } from '@/lib/og';

export const dynamic = 'force-static';
export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'K Clinics treatment';

export function generateStaticParams() {
  return treatmentSlugs.map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getTreatment(slug);
  const eyebrow = t?.category === 'dentistry' ? 'Aesthetic Dentistry' : 'Aesthetics';
  return renderOg({ eyebrow, title: t?.title ?? 'Treatments', accent: t?.tagline ?? 'perfected.' });
}
