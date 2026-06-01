import { site } from '@/lib/site';
import { treatments } from '@/lib/treatments';

export const dynamic = 'force-static';

// llms.txt — a concise, machine-readable guide for AI answer engines & agents
// (the emerging convention at llmstxt.org). Helps assistants cite K Clinics
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
`;

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
