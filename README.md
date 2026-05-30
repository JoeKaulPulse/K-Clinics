# K Clinics — Website

An ultra-premium rebuild of [kclinics.co.uk](https://kclinics.co.uk) — a London clinic
uniting advanced aesthetics (laser & skin) with aesthetic dentistry.

Built for world-class design, fluid premium animation, and best-in-class SEO.

---

## Tech stack

| Concern        | Choice                                                              |
| -------------- | ------------------------------------------------------------------ |
| Framework      | **Next.js 15** (App Router, React 19) — SSG for speed + SEO        |
| Language       | **TypeScript** (strict)                                            |
| Styling        | **Tailwind CSS v4** with a tokenised design system                |
| Animation      | **Motion** (Framer Motion) + CSS scroll/keyframe micro-animations |
| Typography     | **Fraunces** (display serif) + **Geist** (text) — self-hosted      |
| Booking        | **Treatwell** + **Fresha** deep links (config-driven)             |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (static export of 40 pages)
npm run start    # serve the production build
```

## Project structure

```
app/
  layout.tsx            Root layout, fonts, global JSON-LD, header/footer
  page.tsx              Homepage (parallax hero, sections, testimonials)
  [slug]/page.tsx       Dynamic page for all 19 treatments (SSG)
  treatments/           Aesthetics hub
  dentistry/            Dentistry hub
  packages/             Packages list + [slug] detail
  pricing/ about/ membership/ reviews/ faq/ contact/
  sitemap.ts robots.ts manifest.ts opengraph-image.tsx icon.svg
components/
  layout/   Header (mega-menu, mobile drawer), Footer
  home/     Hero, Testimonials
  treatment/TreatmentTemplate  (the premium service-page layout)
  ui/       Button, GenerativeArt, TreatmentCard, FaqAccordion, Marquee, …
  motion/   Reveal, Stagger, WordReveal (reduced-motion aware)
  booking/  BookingButtons (Treatwell + Fresha)
  brand/    Logo
lib/
  site.ts        ← business details, NAP, hours, booking URLs, socials
  treatments.ts  ← all treatment content (drives /[slug] pages + SEO)
  packages.ts    reviews.ts  faqs.ts  nav.ts  seo.tsx (metadata + JSON-LD)
```

## Customising the brand

Everything brand-level is centralised:

- **Colour palette & type** — `app/globals.css`, the `@theme` block. Change the
  `--color-*` tokens to re-skin the entire site in one place.
- **Business details / NAP / hours / socials** — `lib/site.ts`.
- **Booking links** — `lib/site.ts` → `booking.treatwell` / `booking.fresha`.
- **Treatment content & SEO copy** — `lib/treatments.ts`.
- **Navigation / mega-menu** — `lib/nav.ts`.

> **Note on imagery:** there are no photographs baked with text. The visual layer
> uses generative gradient "art" (`GenerativeArt`) so that *all copy stays live HTML*.
> Drop real photography into these slots later without ever overlaying baked text.

## SEO features

- Per-page `<title>`, meta description, canonical, OpenGraph + Twitter cards
- Dynamic OG image (`/opengraph-image`)
- JSON-LD: `MedicalClinic`/`Dentist`, `MedicalProcedure`, `FAQPage`,
  `BreadcrumbList`, `AggregateRating`/`Review`
- `sitemap.xml`, `robots.txt`, web manifest
- 301/308 redirects from legacy URLs (`next.config.mjs`) to preserve link equity
- Fully server-rendered content (indexable) + ~105 KB shared JS

## Deployment

Optimised for **Vercel** (zero-config). Also deployable to any Node host, or as a
static export to Netlify / Cloudflare Pages.

1. Push to GitHub (done).
2. Import the repo into Vercel.
3. Set the production domain and update `site.url` in `lib/site.ts`.

---

## ✅ Launch checklist — assets needed from the client

These use sensible placeholders today; supply real values before go-live:

- [ ] **Brand palette** — exact hex codes / logo source (the live site blocks
      automated extraction, so a refined luxury palette is in place as a swappable default).
- [ ] **Treatwell & Fresha venue URLs** → `lib/site.ts`.
- [ ] **Verified phone, email, address, opening hours** → `lib/site.ts`.
- [ ] **Real pricing** → `lib/treatments.ts` (`priceFrom`) & packages.
- [ ] **Clinician names + GDC/credentials** (adds strong E-E-A-T for SEO).
- [ ] **Photography** for treatment / clinic imagery (drop into the art slots).
- [ ] **Verified Google/Trustpilot reviews** → `lib/reviews.ts`.
- [ ] Set the canonical production domain in `lib/site.ts`.

See `docs/RESEARCH.md` for the full research brief and information architecture.
