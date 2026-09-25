import { site } from '@/lib/site';
import { treatments } from '@/lib/treatments';
import { generalFaqs } from '@/lib/faqs';
import { academyFaqs } from '@/lib/academy-faqs';
import { academyPolicies } from '@/lib/academy-policies';
import { FUNDING_ROUTES, FUNDING_OUTLOOK } from '@/lib/funding';
import { infoPages } from '@/lib/info-pages';

// llms-full.txt — the long-form companion to /llms.txt (llmstxt.org): the
// full public text of every treatment, course, policy and FAQ in one plain
// document, so an answer engine can ground a citation without crawling each
// page. Regenerated hourly (ISR); DB reads are best-effort.
export const revalidate = 3600;

const fee = (pence: number | null | undefined) => (pence && pence > 0 ? `£${(pence / 100).toLocaleString('en-GB')}` : 'fee on enquiry');
const clean = (s: string | null | undefined) => (s || '').replace(/\r/g, '').trim();

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
  const { getSiteConfig } = await import('@/lib/site-config');
  const { dentistryLive } = await getSiteConfig();
  const { listCourses, listBundles, ACCREDITATION_LABELS } = await import('@/lib/academy');
  const [courses, bundles] = await Promise.all([listCourses().catch(() => []), listBundles().catch(() => [])]);
  let products: { slug: string; name: string; brand: string | null; description: string | null; pricePence: number; inStock?: boolean }[] = [];
  try { const { activeProducts } = await import('@/lib/shop'); products = await activeProducts(); } catch { /* shop not live */ }

  const listed = treatments.filter((t) => t.category === 'aesthetics' || dentistryLive);
  const treatmentText = listed.map((t) => [
    `## ${t.title}`,
    `URL: ${base}/${t.slug}`,
    t.tagline ? `Summary: ${t.tagline}` : '',
    clean(t.intro),
    t.facts?.length ? `Key facts: ${t.facts.map((f) => `${f.label}: ${f.value}`).join('; ')}.` : '',
    t.benefits?.length ? `Benefits:\n${t.benefits.map((b) => `- ${b.title}: ${b.text}`).join('\n')}` : '',
    t.process?.length ? `What happens:\n${t.process.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`).join('\n')}` : '',
    t.faqs?.length ? `FAQs:\n${t.faqs.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}` : '',
  ].filter(Boolean).join('\n\n')).join('\n\n---\n\n');

  const courseText = courses.map((c) => [
    `## ${c.title}${c.level ? ` (${c.level})` : ''}`,
    `URL: ${base}/academy/${c.slug}`,
    `Fee: ${fee(c.pricePence)}${c.depositPence ? ` (deposit ${fee(c.depositPence)})` : ''}${c.durationText ? ` · Duration: ${c.durationText}` : ''}${c.format ? ` · Format: ${c.format}` : ''}`,
    c.accreditations.length ? `Accreditation: ${c.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(', ')}` : '',
    c.prerequisites ? `Prerequisites: ${c.prerequisites}` : '',
    clean(c.summary),
    clean(c.description),
    c.outcomes.length ? `What you learn:\n${c.outcomes.map((o) => `- ${o}`).join('\n')}` : '',
    c.cohorts.length ? `Upcoming cohorts: ${c.cohorts.map((h) => `${h.startAt.toISOString().slice(0, 10)}${h.remaining <= 3 ? ` (${h.remaining} places left)` : ''}`).join(', ')}` : 'Cohorts: enrol any time and join the next suitable cohort.',
  ].filter(Boolean).join('\n\n')).join('\n\n---\n\n');

  const bundleText = bundles.map((b) => [
    `## ${b.title}`, `URL: ${base}/academy/bundles/${b.slug}`, b.pricePence ? `Bundle price: ${fee(b.pricePence)}` : '', clean(b.summary), clean(b.description),
    b.courses.length ? `Includes: ${b.courses.map((c) => `${c.title}${c.level ? ` (${c.level})` : ''}`).join('; ')}` : '',
  ].filter(Boolean).join('\n\n')).join('\n\n---\n\n');

  const policyText = academyPolicies.map((p) => [
    `## ${p.title}`, `URL: ${base}/academy/policies/${p.slug}`, `Version ${p.version} · Reviewed ${p.reviewed} · Next review ${p.nextReview}`, p.summary,
    ...p.sections.map((s) => `### ${s.heading}\n${s.body.join('\n\n')}`),
  ].join('\n\n')).join('\n\n---\n\n');

  const infoText = infoPages.filter((p) => !['careers', 'refer-a-friend', 'gift-vouchers'].includes(p.slug)).map((p) => [
    `## ${p.title}`, `URL: ${base}/info/${p.slug}`, p.intro, ...p.blocks.map((b) => `${b.heading ? `### ${b.heading}\n` : ''}${b.body}`),
  ].join('\n\n')).join('\n\n---\n\n');

  const productText = products.map((p) => [`## ${p.name}${p.brand ? ` (${p.brand})` : ''}`, `URL: ${base}/shop/${p.slug}`, `Price: ${fee(p.pricePence)}`, clean(p.description)].filter(Boolean).join('\n\n')).join('\n\n---\n\n');

  const body = `# ${site.name} — full text for AI answer engines

${site.description}

Legal entity: ${site.legalName} (company no. ${site.companyNumber}). Address: ${site.address.street}, ${site.address.district}, London ${site.address.postalCode}. Phone: ${site.phone}. Email: ${site.email}. Website: ${base}. Short index: ${base}/llms.txt. Generated: ${new Date().toISOString().slice(0, 10)}.

Opening hours: ${site.hours.map((h) => `${h.day} ${h.open === 'Closed' ? 'closed' : `${h.open}–${h.close}`}`).join('; ')}.

# Treatments
${treatmentText}
${dentistryLive ? '' : `\nDentistry is opening soon and is not yet bookable. Register interest at ${base}/dentistry.\n`}
# K Academy
K Academy is the training arm of ${site.name}, delivered inside the working clinic in ${site.address.district}. Qualifications at Levels 2–4 are Ofqual-regulated and awarded through VTCT; short courses are CPD-accredited. Delivery is blended: online theory on Thinkific, practical days in clinic, VTCT exam administered in-house.

${courseText || `Course list: ${base}/academy`}
${bundleText ? `\n# K Academy bundles\n${bundleText}\n` : ''}
# K Academy funding and finance
${FUNDING_OUTLOOK}

${FUNDING_ROUTES.map((r) => `## ${r.name} — ${r.status === 'available' ? 'available now' : 'not available yet (register interest)'}\nWho: ${r.who}. How: ${r.pays}.\n${r.detail}${r.note ? `\n${r.note}` : ''}`).join('\n\n')}

# K Academy centre policies
${policyText}

# K Academy FAQs
${academyFaqs.map((f) => `## ${f.q}\n${f.a}`).join('\n\n')}
${productText ? `\n# Shop\n${productText}\n` : ''}
# Clinic policies and information
${infoText}

# Clinic FAQs
${generalFaqs.map((g) => `## ${g.heading}\n${g.items.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}`).join('\n\n')}
`;

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
