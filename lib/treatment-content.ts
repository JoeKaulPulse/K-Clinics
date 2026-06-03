import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './db';
import { getTreatment, type Treatment, type Benefit, type Step, type Faq } from './treatments';

// DB-backed marketing-content override for treatments (mirrors the Post/Article
// pattern). Any field set on a TreatmentContent row replaces the static copy on
// the public /[slug] page. Read via getMergedTreatment (cached + tag-revalidated
// so edits go live on the next request without a redeploy).

export const TREATMENT_CONTENT_TAG = 'treatment-content';

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
const list = (v: unknown) => (Array.isArray(v) && v.length ? v : undefined);

type Override = {
  title: string | null; tagline: string | null; eyebrow: string | null; intro: string | null;
  metaTitle: string | null; metaDescription: string | null; keywords: string[]; priceFrom: string | null;
  benefits: unknown; process: unknown; faqs: unknown; facts: unknown; related: string[];
};

function merge(base: Treatment, o: Override | null): Treatment {
  if (!o) return base;
  return {
    ...base,
    title: str(o.title) ?? base.title,
    tagline: str(o.tagline) ?? base.tagline,
    eyebrow: str(o.eyebrow) ?? base.eyebrow,
    intro: str(o.intro) ?? base.intro,
    metaTitle: str(o.metaTitle) ?? base.metaTitle,
    metaDescription: str(o.metaDescription) ?? base.metaDescription,
    keywords: list(o.keywords) as string[] ?? base.keywords,
    priceFrom: str(o.priceFrom) ?? base.priceFrom,
    benefits: (list(o.benefits) as Benefit[]) ?? base.benefits,
    process: (list(o.process) as Step[]) ?? base.process,
    faqs: (list(o.faqs) as Faq[]) ?? base.faqs,
    facts: (list(o.facts) as { label: string; value: string }[]) ?? base.facts,
    related: (list(o.related) as string[]) ?? base.related,
  };
}

async function loadOverride(slug: string): Promise<Override | null> {
  try { return (await db.treatmentContent.findUnique({ where: { slug } })) as Override | null; }
  catch { return null; }
}

/** Static treatment merged with its admin override (cached for ISR). */
export function getMergedTreatment(slug: string): Promise<Treatment | null> {
  return unstable_cache(
    async () => { const base = getTreatment(slug); return base ? merge(base, await loadOverride(slug)) : null; },
    ['treatment-merged', slug],
    { tags: [TREATMENT_CONTENT_TAG, `treatment-${slug}`], revalidate: 3600 },
  )();
}

/** For the editor: the static default + the current override row (if any). */
export async function getTreatmentContentForEdit(slug: string) {
  const base = getTreatment(slug);
  if (!base) return null;
  const override = await loadOverride(slug);
  return { base, override };
}
