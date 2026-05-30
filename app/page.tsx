import Link from 'next/link';
import { Hero } from '@/components/home/Hero';
import { Testimonials } from '@/components/home/Testimonials';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { SectionHeading } from '@/components/ui/Section';
import { TreatmentCard } from '@/components/ui/TreatmentCard';
import { Marquee } from '@/components/ui/Marquee';
import { GenerativeArt } from '@/components/ui/GenerativeArt';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { BookingProviders } from '@/components/booking/BookingButtons';
import { CountUp } from '@/components/motion/CountUp';
import { Aurora } from '@/components/ui/Aurora';
import { treatments, getTreatment } from '@/lib/treatments';
import { packages } from '@/lib/packages';
import { site } from '@/lib/site';
import { JsonLd, breadcrumbLd } from '@/lib/seo';

const featured = ['laser-hair-removal', 'smas-hifu-lifting', 'hydraglow-facial', 'veneers', 'body-contouring', 'cosmetic-injections']
  .map(getTreatment)
  .filter(Boolean) as typeof treatments;

const pillars = [
  { stat: '15+', label: 'Years of clinical artistry', text: 'A decade and more refining technique, technology and taste.' },
  { stat: '40+', label: 'Advanced treatments', text: 'One address for face, body, skin and smile.' },
  { stat: site.ratingValue, label: 'Average client rating', text: `From ${site.reviewCount}+ reviews across London.` },
  { stat: '100%', label: 'Bespoke plans', text: 'Every protocol designed around one person — you.' },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }])} />
      <Hero />

      {/* Marquee ribbon */}
      <section className="border-y border-[var(--color-line)] bg-[var(--color-bone)] py-8">
        <Marquee items={['Laser & Skin', 'Aesthetic Dentistry', 'Non-Surgical Lifting', 'Body Contouring', 'Injectable Artistry', 'Smile Design']} />
      </section>

      {/* Editorial intro — asymmetric two-column statement */}
      <section className="section container-lux">
        <div className="grid gap-x-16 gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="eyebrow mb-7 inline-flex items-center gap-2.5">
                <span className="h-px w-7 bg-[var(--color-gold)]/60" />
                Two disciplines, one standard
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="text-display max-w-4xl">
                The science of beautiful skin.{' '}
                <span className="text-gold-gradient">The art of a perfect smile.</span>
              </h2>
            </Reveal>
          </div>
          <div className="flex flex-col justify-end lg:col-span-5">
            <Reveal delay={0.12}>
              <p className="text-lede leading-relaxed text-[var(--color-stone)]">
                K Clinics was built on a simple conviction: that aesthetics and dentistry, practised at the
                highest level under one roof, create a more complete kind of confidence.
              </p>
              <div className="mt-8 flex gap-3">
                <Button href="/treatments">Explore treatments <ArrowIcon /></Button>
                <Button href="/about" variant="outline">Our story</Button>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Dual discipline — taller, more dramatic cards */}
        <div className="mt-[var(--space-block)] grid gap-5 lg:grid-cols-2">
          {[
            {
              tag: 'Aesthetics',
              href: '/treatments',
              title: 'Laser, Skin & Body',
              text: 'Medical-grade laser hair removal, non-surgical lifting, advanced facials, body contouring and refined injectables.',
              grad: ['#b08544', '#7a4f57'] as [string, string],
            },
            {
              tag: 'Dentistry',
              href: '/dentistry',
              title: 'Aesthetic Dentistry',
              text: 'Smile design, porcelain veneers, professional whitening, composite bonding and life-changing dental implants.',
              grad: ['#7a4f57', '#2b1d24'] as [string, string],
            },
          ].map((c, idx) => (
            <Reveal key={c.tag} delay={idx * 0.1}>
              <Link
                href={c.href}
                className="group relative flex h-full min-h-[20rem] flex-col justify-end overflow-hidden rounded-[var(--radius-2xl)] p-8 text-[var(--color-porcelain)] sm:min-h-[26rem] md:min-h-[32rem] md:p-12"
              >
                <GenerativeArt
                  from={c.grad[0]}
                  to={c.grad[1]}
                  seed={idx * 2}
                  className="absolute inset-0 -z-0 transition-transform duration-[1.6s] [transition-timing-function:var(--ease-lux)] group-hover:scale-105"
                />
                <div className="relative">
                  <p className="eyebrow mb-4 text-[var(--color-gold-soft)]">{c.tag}</p>
                  <h3 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+2vw,3.25rem)] leading-[1.05]">{c.title}</h3>
                  <p className="mt-5 max-w-md leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_84%,transparent)]">{c.text}</p>
                  <span className="mt-7 inline-flex items-center gap-2 font-medium text-[var(--color-gold-soft)]">
                    Explore {c.tag.toLowerCase()} <ArrowIcon />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured treatments */}
      <section className="section bg-[var(--color-bone)]">
        <div className="container-lux">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <SectionHeading eyebrow="Signature treatments" title="The most requested, in considered hands." />
            <Reveal>
              <Button href="/treatments" variant="outline">
                View all treatments <ArrowIcon />
              </Button>
            </Reveal>
          </div>
          <Stagger className="mt-[var(--space-block)] grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((t, i) => (
              <StaggerItem key={t.slug}>
                <TreatmentCard t={t} index={i} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Why us / pillars */}
      <section className="section container-lux">
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeading
            eyebrow="Why K Clinics"
            title="Exceptional results begin with exceptional standards."
            lede="World-class technology means little without the judgement to wield it. Our clinicians pair clinical rigour with an artist's eye — and the patience to do things properly."
          />
          <Stagger className="grid gap-px overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
            {pillars.map((p) => (
              <StaggerItem key={p.label} className="bg-[var(--color-porcelain)] p-9 md:p-10">
                <CountUp value={p.stat} className="block font-[family-name:var(--font-display)] text-[clamp(3rem,2rem+2vw,4.5rem)] leading-none text-gold-gradient" />
                <span className="sr-only">{p.stat}</span>
                <p className="mt-4 font-medium">{p.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{p.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* The experience */}
      <section className="surface-ink grain section relative">
        <Aurora />
        <div className="container-lux relative">
          <SectionHeading
            tone="light"
            align="center"
            eyebrow="The K Clinics experience"
            title="Considered from the first hello."
            lede="From an unhurried consultation to a plan made only for you, every detail is designed to feel calm, private and quietly luxurious."
          />
          <Stagger className="mt-[var(--space-block)] grid gap-12 md:grid-cols-3 md:gap-8">
            {[
              { n: '01', t: 'Consultation', d: 'We listen first. A thorough, unhurried assessment of your goals, your skin or your smile — and complete transparency on what is possible.' },
              { n: '02', t: 'Your bespoke plan', d: 'A clear, staged plan tailored to you, with the right treatments sequenced for results that build beautifully over time.' },
              { n: '03', t: 'Refined results', d: 'Expert delivery, attentive aftercare and outcomes that look natural, considered and unmistakably yours.' },
            ].map((s) => (
              <StaggerItem key={s.n} className="relative border-t border-white/15 pt-7">
                <p className="font-[family-name:var(--font-display)] text-[clamp(3.5rem,2.5rem+2vw,5rem)] leading-none text-[var(--color-gold)]/45">{s.n}</p>
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-2xl text-[var(--color-porcelain)] md:text-[1.75rem]">{s.t}</h3>
                <p className="mt-3 leading-relaxed text-[color-mix(in_oklab,var(--color-porcelain)_70%,transparent)]">{s.d}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Packages teaser */}
      <section className="section container-lux">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <SectionHeading eyebrow="Curated programmes" title="Signature packages, designed to transform." />
          <Reveal>
            <Button href="/packages" variant="outline">
              All packages <ArrowIcon />
            </Button>
          </Reveal>
        </div>
        <Stagger className="mt-[var(--space-block)] grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {packages.map((p, i) => (
            <StaggerItem key={p.slug}>
              <Link
                href={`/packages/${p.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] transition-all duration-700 hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]"
              >
                <GenerativeArt from={p.gradient[0]} to={p.gradient[1]} seed={i} className="aspect-[4/3]" />
                <div className="flex flex-1 flex-col p-7">
                  <h3 className="font-[family-name:var(--font-display)] text-[1.35rem] leading-tight">{p.name}</h3>
                  <p className="mt-2 text-sm text-[var(--color-stone)]">{p.subtitle}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-gold)]">
                    Explore <ArrowIcon />
                  </span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Testimonials */}
      <section className="surface-ink grain section relative">
        <Aurora />
        <div className="container-lux relative">
          <Testimonials />
        </div>
      </section>

      {/* Offer / membership */}
      <section className="section container-lux">
        <Reveal>
          <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-10 md:p-20">
            <GenerativeArt from="#c9a86a" to="#7a4f57" className="absolute right-0 top-0 hidden h-full w-2/5 opacity-90 md:block" />
            <span className="pointer-events-none absolute right-0 top-0 hidden h-full w-2/5 bg-gradient-to-r from-[var(--color-bone)] to-transparent md:block" />
            <div className="relative max-w-xl">
              <p className="eyebrow mb-5">Beauty Points · Membership</p>
              <h2 className="text-title">Rewarded for radiance.</h2>
              <p className="mt-6 text-lede leading-relaxed text-[var(--color-stone)]">
                Every treatment earns Beauty Points toward future visits, with members enjoying priority booking, exclusive events and seasonal privileges. Confidence, recognised.
              </p>
              <div className="mt-9">
                <Button href="/membership">
                  Discover membership <ArrowIcon />
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Visit */}
      <section className="section bg-[var(--color-bone)]">
        <div className="container-lux grid gap-x-16 gap-y-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="eyebrow mb-6 inline-flex items-center gap-2.5">
              <span className="h-px w-7 bg-[var(--color-gold)]/60" />
              Find us
            </p>
            <h2 className="text-title">In the heart of Clerkenwell.</h2>
            <p className="mt-6 text-lede leading-relaxed text-[var(--color-stone)]">
              Moments from Farringdon and Barbican, our Islington clinic is a calm, private sanctuary designed for one purpose — to make you feel extraordinary.
            </p>
            <dl className="mt-9 space-y-5 text-[var(--color-ink-soft)]">
              <div>
                <dt className="eyebrow mb-1.5">Address</dt>
                <dd>{site.address.street}, {site.address.locality}, {site.address.region} {site.address.postalCode}</dd>
              </div>
              <div className="flex gap-12">
                <div>
                  <dt className="eyebrow mb-1.5">Call</dt>
                  <dd><a href={site.phoneHref} className="link-underline">{site.phone}</a></dd>
                </div>
                <div>
                  <dt className="eyebrow mb-1.5">Email</dt>
                  <dd><a href={site.emailHref} className="link-underline">{site.email}</a></dd>
                </div>
              </div>
            </dl>
            <div className="mt-9">
              <BookingProviders />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] shadow-[var(--shadow-soft)]">
              <iframe
                title="K Clinics location map"
                src={site.mapEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[460px] w-full grayscale-[0.2]"
              />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
