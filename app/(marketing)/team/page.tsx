import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { MediaArt } from '@/components/ui/MediaArt';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { team } from '@/lib/team';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Our Team — Expert Clinicians & Practitioners | K Clinics London',
  description:
    'Meet the K Clinics team — qualified, registered aesthetic doctors, laser specialists and cosmetic dentists delivering safe, artful results in Islington, London.',
  path: '/team',
  keywords: ['K Clinics team', 'aesthetic doctor London', 'cosmetic dentist Islington', 'laser specialist London'],
});

function teamLd() {
  const base = site.url;
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    '@id': `${base}/#clinic`,
    name: site.name,
    employee: team.map((p) => ({
      '@type': 'Person',
      name: p.name,
      jobTitle: p.role,
      worksFor: { '@id': `${base}/#clinic` },
      knowsAbout: p.focus,
    })),
  };
}

export default function TeamPage() {
  return (
    <>
      <JsonLd data={[teamLd(), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Our Team', path: '/team' }])]} />
      <PageHero
        eyebrow="The people behind the results"
        title="Expert hands, an artist’s eye."
        lede="Your care is delivered by qualified, registered clinicians who combine clinical rigour with a genuine eye for natural, balanced results — and the patience to do things properly."
        gradient={['#7b6a5d', '#2a2420']}
      >
        <BookingButtons />
      </PageHero>

      <section className="container-lux section">
        <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {team.map((p, i) => (
            <StaggerItem key={p.slug}>
              <div className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-line)]">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <MediaArt src={null} from={i % 2 ? '#a98a6d' : '#7b6a5d'} to="#2a2420" seed={i} alt={p.name} className="h-full w-full" />
                </div>
                <div className="flex flex-1 flex-col p-7">
                  <h2 className="font-[family-name:var(--font-display)] text-xl">{p.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-gold)]">{p.role}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--color-stone)]">{p.credentials}</p>
                  <p className="mt-4 flex-1 leading-relaxed text-[var(--color-stone)]">{p.bio}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {p.focus.map((f) => (
                      <span key={f} className="rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs text-[var(--color-ink-soft)]">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal>
          <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-[var(--color-stone)]">
            All K Clinics practitioners hold the relevant professional registrations and undertake ongoing training.
            Registration details are available on request and displayed in clinic.
          </p>
        </Reveal>
      </section>
    </>
  );
}
