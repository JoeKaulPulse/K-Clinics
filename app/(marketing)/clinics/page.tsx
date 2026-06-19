import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { AccessBadges } from '@/components/ui/AccessBadges';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd, organizationLd } from '@/lib/seo';

// BLD-517: hourly ISR so these mostly-static pages are cached, not full SSR per request.
export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Our Clinic — Find Us in Islington, London | KClinics',
  description:
    'Visit KClinics on the border of the City of London and Islington — 4 Charterhouse Buildings, Goswell Road, EC1M 7AN. Step-free access, parking nearby and minutes from Barbican, Farringdon and Old Street.',
  path: '/clinics',
  keywords: ['KClinics location', 'aesthetics clinic Islington', 'clinic near Barbican Farringdon'],
});

const TUBE = ['Barbican', 'Farringdon', 'Old Street', "St Paul's", 'Angel'];
const CARPARKS = [
  ['Barbican Centre Car Park', 'EC2Y 8DS'],
  ['NCP London Barbican', 'EC1A 4HY'],
  ['Smithfield Car Park', 'EC1A 9DY'],
];

export default async function ClinicsPage() {
  const { getPublishedPage } = await import('@/lib/pages');
  const cms = await getPublishedPage('/clinics');
  if (cms) {
    const { SectionRenderer } = await import('@/components/cms/SectionRenderer');
    return (<><JsonLd data={[organizationLd(), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Our Clinics', path: '/clinics' }])]} /><SectionRenderer sections={cms} /></>);
  }
  return (
    <>
      <JsonLd data={[organizationLd(), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Our Clinics', path: '/clinics' }])]} />
      <PageHero
        eyebrow="Our clinic"
        title="Find us in Clerkenwell."
        lede="KClinics sits on the border of the City of London and Islington — a calm, private space minutes from Barbican, Farringdon and Old Street, easily reached on foot, by tube or by car."
        gradient={['#2a2420', '#7b6a5d']}
      >
        <BookingButtons />
      </PageHero>

      {/* Address + map */}
      <section className="container-lux section grid gap-10 lg:grid-cols-2 lg:items-start">
        <Reveal>
          <p className="eyebrow mb-3">Where to find us</p>
          <h2 className="text-title">{site.address.locality}.</h2>
          <dl className="mt-7 space-y-5 text-[var(--color-ink-soft)]">
            <div>
              <dt className="eyebrow mb-1.5">Address</dt>
              <dd><a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="link-underline">{site.address.street}, {site.address.region} {site.address.postalCode}</a></dd>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-5">
              <div><dt className="eyebrow mb-1.5">Call</dt><dd><a href={site.phoneHref} className="link-underline">{site.phone}</a></dd></div>
              <div><dt className="eyebrow mb-1.5">Email</dt><dd><a href={site.emailHref} className="link-underline">{site.email}</a></dd></div>
            </div>
            <div>
              <dt className="eyebrow mb-2">Opening hours</dt>
              <dd>
                <ul className="space-y-1 text-sm">
                  {site.hours.map((h) => (
                    <li key={h.day} className="flex justify-between gap-8 border-b border-[var(--color-line)] py-1.5 last:border-0">
                      <span>{h.day}</span>
                      <span className="text-[var(--color-stone)]">{h.open === 'Closed' ? 'Closed' : `${h.open} – ${h.close}`}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)] shadow-[var(--shadow-soft)]">
            <iframe title="KClinics location map" src={site.mapEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-[460px] w-full grayscale-[0.2]" />
          </div>
        </Reveal>
      </section>

      {/* Getting here */}
      <section className="bg-[var(--color-bone)] section">
        <div className="container-lux">
          <Reveal><p className="eyebrow mb-3">Getting here</p><h2 className="text-title">However you travel.</h2></Reveal>
          <Stagger className="mt-[var(--space-block)] grid gap-6 md:grid-cols-3">
            <StaggerItem>
              <div className="h-full rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-7">
                <h3 className="font-[family-name:var(--font-display)] text-xl">By tube</h3>
                <p className="mt-2 text-sm text-[var(--color-stone)]">A short walk from several Underground stations:</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {TUBE.map((t) => <li key={t} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs">{t}</li>)}
                </ul>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="h-full rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-7">
                <h3 className="font-[family-name:var(--font-display)] text-xl">By bus</h3>
                <p className="mt-2 text-sm text-[var(--color-stone)]">Several routes stop on nearby Old Street, around a 7-minute walk — including route 55 between Leyton and Oxford Circus.</p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="h-full rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-7">
                <h3 className="font-[family-name:var(--font-display)] text-xl">By car</h3>
                <p className="mt-2 text-sm text-[var(--color-stone)]">Set your sat-nav to <strong className="text-[var(--color-ink)]">EC1M 7AN</strong>. Paid car parks nearby:</p>
                <ul className="mt-3 space-y-1 text-sm text-[var(--color-stone)]">
                  {CARPARKS.map(([n, pc]) => <li key={pc}>{n} <span className="text-[var(--color-stone)]">· {pc}</span></li>)}
                </ul>
                <p className="mt-3 text-xs text-[var(--color-stone)]">On-street parking around Goswell Road is limited and restrictions may apply. The clinic is within the Congestion Charge zone — please check charges before arrival.</p>
              </div>
            </StaggerItem>
          </Stagger>
        </div>
      </section>

      {/* Accessibility */}
      <section className="container-lux section">
        <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 md:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="eyebrow mb-3">Access for everyone</p>
              <h2 className="text-title">Comfortable, and easy to reach.</h2>
              <ul className="mt-6 space-y-3 text-[var(--color-ink-soft)]">
                <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> Step-free, wheelchair-accessible entrance.</li>
                <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> Accessible parking as close to the entrance as possible.</li>
                <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> Spacious, comfortable waiting areas for clients using mobility aids.</li>
              </ul>
              <p className="mt-5 text-sm text-[var(--color-stone)]">Anything you need to make your visit easier? Tell us when you book, or read our <a href="/info/accessibility" className="link-underline font-medium text-[var(--color-ink)]">accessibility statement</a>.</p>
            </div>
            <AccessBadges tone="light" className="lg:justify-end" />
          </div>
        </div>
      </section>
    </>
  );
}
