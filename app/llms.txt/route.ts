import { site } from '@/lib/site';
import { treatments } from '@/lib/treatments';
import { allGeneralFaqs } from '@/lib/faqs';

export const dynamic = 'force-static';

// llms.txt — a concise, machine-readable guide for AI answer engines & agents
// (the emerging convention at llmstxt.org). Helps assistants cite KClinics
// accurately. Static and dependency-free so it's safe in any build.
export function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
  const aesthetics = treatments.filter((t) => t.category === 'aesthetics');
  const dentistry = treatments.filter((t) => t.category === 'dentistry');
  const line = (t: { slug: string; title: string; tagline?: string }) => `- [${t.title}](${base}/${t.slug})${t.tagline ? `: ${t.tagline}` : ''}`;

  const body = `# ${site.name}

> ${site.name} is an aesthetics and dentistry clinic in ${site.address.locality}, London, offering laser, skin, injectable and smile treatments — plus K Academy, an Ofqual-regulated, VTCT and CPD-accredited training centre for clinicians.

Location: ${site.address.street}, ${site.address.locality}, London. Phone: ${site.phone}. Booking: ${base}/book

## Key pages
- [Home](${base}/): clinic overview and booking
- [All treatments](${base}/treatments)
- [Dentistry](${base}/dentistry)
- [Pricing](${base}/pricing): full transparent price list
- [Book online](${base}/book): account-based booking, card saved, charged on delivery
- [K Academy](${base}/academy): accredited aesthetics training (Levels 2–7)
- [About](${base}/about) · [Team](${base}/team) · [Reviews](${base}/reviews) · [Contact](${base}/contact)

## Aesthetic treatments
${aesthetics.map(line).join('\n')}

## Dentistry
${dentistry.map(line).join('\n')}

## Training (K Academy)
- [Courses & enrolment](${base}/academy): Ofqual-regulated, VTCT & CPD-accredited; blended Thinkific theory + practical days + in-house VTCT exam; Clearpay finance available.

## Opening hours (Europe/London)
${site.hours.map((h) => `- ${h.day}: ${h.open === 'Closed' ? 'Closed' : `${h.open}–${h.close}`}`).join('\n')}

## Key facts
- Consultations are complimentary, with no obligation to proceed.
- New clients enjoy 15% off their first visit (aesthetic or dental).
- Booking is online: pick a treatment & time, save a card securely — charged only once the treatment is delivered.
- Free cancellation up to 24 hours before an appointment; within 24 hours the full fee applies.
- Finance: pay-as-you-go courses, 0% interest-free options and Buy Now, Pay Later via Clearpay & Klarna.
- Location & transport: ${site.address.street}, ${site.address.locality}, ${site.address.postalCode} — minutes from Farringdon, Barbican and Old Street; step-free access.
- Dentistry is ${site.dentistryLive ? 'open and bookable' : 'opening soon (register interest on the dentistry page)'}.

## FAQs
${allGeneralFaqs.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}
`;

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
