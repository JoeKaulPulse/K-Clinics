import { site } from '@/lib/site';
import { treatments } from '@/lib/treatments';
import { allGeneralFaqs } from '@/lib/faqs';
import { academyFaqs } from '@/lib/academy-faqs';
import { academyPolicies } from '@/lib/academy-policies';
import { FUNDING_ROUTES, FUNDING_OUTLOOK } from '@/lib/funding';
import { infoPages } from '@/lib/info-pages';

// llms.txt — a concise, machine-readable guide for AI answer engines & agents
// (the convention at llmstxt.org). Helps assistants cite KClinics and K Academy
// accurately. ISR (like sitemap.ts) so DB-backed academy courses, bundles and
// shop products appear within the hour without a redeploy; every DB read is
// best-effort and falls back to the static defaults on a DB-less build.
// The long-form companion, /llms-full.txt, carries full page text.
export const revalidate = 3600;

const fee = (pence: number | null | undefined) => (pence && pence > 0 ? `£${(pence / 100).toLocaleString('en-GB')}` : 'fee on enquiry');

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
  const aesthetics = treatments.filter((t) => t.category === 'aesthetics');
  const dentistry = treatments.filter((t) => t.category === 'dentistry');
  const line = (t: { slug: string; title: string; tagline?: string }) => `- [${t.title}](${base}/${t.slug})${t.tagline ? `: ${t.tagline}` : ''}`;
  // BLD-1683: read the real admin-toggleable flag (same call sitemap.ts and
  // the treatment pages already make) instead of the static site.dentistryLive
  // constant, so an AI answer engine doesn't keep telling users dentistry
  // isn't bookable after the owner flips it on elsewhere.
  const { getSiteConfig } = await import('@/lib/site-config');
  const { dentistryLive } = await getSiteConfig();

  // Live academy catalogue + shop (best-effort; empty arrays on a DB-less build).
  const { listCourses, listBundles, ACCREDITATION_LABELS } = await import('@/lib/academy');
  const [courses, bundles] = await Promise.all([listCourses().catch(() => []), listBundles().catch(() => [])]);
  let products: { slug: string; name: string; brand: string | null; pricePence: number }[] = [];
  try { const { activeProducts } = await import('@/lib/shop'); products = await activeProducts(); } catch { /* shop not live */ }

  const courseLines = courses.length
    ? courses.map((c) => `- [${c.title}](${base}/academy/${c.slug})${c.level ? ` — ${c.level}` : ''}; ${fee(c.pricePence)}${c.durationText ? `; ${c.durationText}` : ''}${c.accreditations.length ? `; ${c.accreditations.map((a) => ACCREDITATION_LABELS[a] ?? a).join(', ')}` : ''}${c.summary ? `. ${c.summary}` : ''}`)
    : [`- Course list: ${base}/academy (Levels 2–7; the live schedule is published there).`];
  const bundleLines = bundles.map((b) => `- [${b.title}](${base}/academy/bundles/${b.slug})${b.pricePence ? `; ${fee(b.pricePence)}` : ''}${b.summary ? `. ${b.summary}` : ''}`);
  const productLines = products.map((p) => `- [${p.name}](${base}/shop/${p.slug})${p.brand ? ` (${p.brand})` : ''}; ${fee(p.pricePence)}`);
  const policyLines = academyPolicies.map((p) => `- [${p.title}](${base}/academy/policies/${p.slug}): ${p.summary}`);
  const infoLines = infoPages.filter((p) => !['careers', 'refer-a-friend', 'gift-vouchers', 'concierge-services', 'franchise-opportunities', 'payment-option'].includes(p.slug)).map((p) => `- [${p.title}](${base}/info/${p.slug})`);
  const fundingLines = FUNDING_ROUTES.map((r) => `- ${r.name} — ${r.status === 'available' ? 'available now' : 'not available yet (register interest)'}. ${r.who}. ${r.pays}.`);

  const body = `# ${site.name}

> ${site.name} is an aesthetics and dentistry clinic in ${site.address.locality}, London, offering laser, skin, injectable and smile treatments — plus K Academy, an Ofqual-regulated, VTCT and CPD-accredited training centre for clinicians.

Location: ${site.address.street}, ${site.address.locality}, London ${site.address.postalCode}. Phone: ${site.phone}. Email: ${site.email}. Booking: ${base}/book
Legal entity: ${site.legalName} (company no. ${site.companyNumber}). Opened ${site.founded}.
Full page text for citation: ${base}/llms-full.txt · Sitemap: ${base}/sitemap.xml · Last generated: ${new Date().toISOString().slice(0, 10)}

## Key pages
- [Home](${base}/): clinic overview and booking
- [All treatments](${base}/treatments)
- [Dentistry](${base}/dentistry)
- [Pricing](${base}/pricing): full transparent price list
- [Book online](${base}/book): account-based booking, card saved, charged on delivery
- [K Academy](${base}/academy): accredited aesthetics training (Levels 2–7)
- [Academy funding & finance](${base}/academy/funding) · [Centre policies](${base}/academy/policies)
${products.length ? `- [Shop](${base}/shop): clinic-grade skincare and products, delivered or collected in clinic\n` : ''}- [About](${base}/about) · [Team](${base}/team) · [Reviews](${base}/reviews) · [Contact](${base}/contact) · [FAQ](${base}/faq)

## Aesthetic treatments
${aesthetics.map(line).join('\n')}

## Dentistry
${dentistryLive ? dentistry.map(line).join('\n') : `Dentistry is opening soon and not yet bookable — see [Dentistry](${base}/dentistry) to register interest.`}

## K Academy (training)
K Academy is the training arm of ${site.name}, based inside the clinic at ${site.address.street}, ${site.address.locality}. Qualifications are Ofqual-regulated and awarded through VTCT (Levels 2–4); short courses are CPD-accredited. Delivery is blended: online theory on Thinkific, practical days in the working clinic, VTCT exam administered in-house. Learners can enrol at any time and join the next suitable cohort.

### Courses
${courseLines.join('\n')}
${bundleLines.length ? `\n### Course bundles (learning pathways)\n${bundleLines.join('\n')}\n` : ''}
### Funding and finance
${FUNDING_OUTLOOK}
${fundingLines.join('\n')}
Details: ${base}/academy/funding

### Centre policies
${policyLines.join('\n')}
${products.length ? `\n## Shop\n${productLines.join('\n')}\n` : ''}
## Opening hours (Europe/London)
${site.hours.map((h) => `- ${h.day}: ${h.open === 'Closed' ? 'Closed' : `${h.open}–${h.close}`}`).join('\n')}

## Key facts
- Consultations are complimentary, with no obligation to proceed.
- New clients enjoy 15% off their first visit (aesthetic or dental).
- Booking is online: pick a treatment & time, save a card securely — charged only once the treatment is delivered.
- Free cancellation up to 24 hours before an appointment; within 24 hours the full fee applies.
- Finance: pay-as-you-go courses and 0% interest-free options on eligible treatments.
- Location & transport: ${site.address.street}, ${site.address.locality}, ${site.address.postalCode} — minutes from Farringdon, Barbican and Old Street; step-free access.
- Dentistry is ${dentistryLive ? 'open and bookable' : 'opening soon (register interest on the dentistry page)'}.

## Clinic policies
${infoLines.join('\n')}

## Clinic FAQs
${allGeneralFaqs.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

## K Academy FAQs
${academyFaqs.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}
`;

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
