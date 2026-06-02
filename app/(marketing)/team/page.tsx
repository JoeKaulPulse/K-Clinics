import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { BookingButtons } from '@/components/booking/BookingButtons';
import { team as fallbackTeam } from '@/lib/team';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';
import type { TeamMember } from '@/lib/team-data';

export const metadata: Metadata = pageMeta({
  title: 'Our Team — Expert Clinicians & Practitioners | K Clinics London',
  description:
    'Meet the K Clinics team — qualified aesthetic doctors, laser specialists and cosmetic dentists, with their experience, ratings and specialisms, delivering safe, artful results in Islington, London.',
  path: '/team',
  keywords: ['K Clinics team', 'aesthetic doctor London', 'cosmetic dentist Islington', 'laser specialist London'],
});

export const revalidate = 600; // ISR: cached, revalidated in the background

function teamLd(members: TeamMember[]) {
  const base = site.url;
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    '@id': `${base}/#clinic`,
    name: site.name,
    employee: members.map((p) => ({ '@type': 'Person', name: p.name, jobTitle: p.title ?? undefined, worksFor: { '@id': `${base}/#clinic` }, knowsAbout: p.services })),
  };
}

export default async function TeamPage() {
  let clinicians: TeamMember[] = [];
  let support: TeamMember[] = [];
  try { ({ clinicians, support } = await (await import('@/lib/team-data')).publicTeam()); } catch { /* DB optional */ }
  const hasDbTeam = clinicians.length + support.length > 0;

  return (
    <>
      <JsonLd data={[teamLd([...clinicians, ...support]), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Our Team', path: '/team' }])]} />
      <PageHero
        eyebrow="The people behind the results"
        title="Expert hands, an artist’s eye."
        lede="Your care is delivered by qualified, registered clinicians who combine clinical rigour with a genuine eye for natural, balanced results — and the patience to do things properly."
        gradient={['#7b6a5d', '#2a2420']}
      >
        <BookingButtons />
      </PageHero>

      {hasDbTeam ? (
        <>
          <section className="container-lux section">
            {clinicians.length > 0 && <Reveal><p className="eyebrow mb-8">Clinical team</p></Reveal>}
            <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {clinicians.map((m) => <StaggerItem key={m.id}><Card m={m} /></StaggerItem>)}
            </Stagger>
          </section>
          {support.length > 0 && (
            <section className="container-lux pb-[var(--space-section)]">
              <Reveal><p className="eyebrow mb-8">Front desk &amp; support team</p></Reveal>
              <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {support.map((m) => <StaggerItem key={m.id}><Card m={m} /></StaggerItem>)}
              </Stagger>
            </section>
          )}
        </>
      ) : (
        // Graceful fallback until staff enable their public profiles in the CRM.
        <section className="container-lux section">
          <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {fallbackTeam.map((p) => (
              <StaggerItem key={p.slug}>
                <div className="h-full rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-7">
                  <h3 className="font-[family-name:var(--font-display)] text-2xl">{p.name}</h3>
                  <p className="mt-1 text-sm uppercase tracking-[0.14em] text-[var(--color-gold)]">{p.role}</p>
                  <p className="mt-4 text-[var(--color-ink-soft)]">{p.bio}</p>
                  {p.focus.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{p.focus.map((f) => <span key={f} className="rounded-full bg-[var(--color-porcelain)] px-2.5 py-1 text-xs text-[var(--color-stone)]">{f}</span>)}</div>}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </>
  );
}

function Stars({ rating, count }: { rating: number; count: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="text-[var(--color-gold)]">{'★★★★★'.slice(0, full)}<span className="text-[var(--color-line)]">{'★★★★★'.slice(full)}</span></span>
      <span className="text-[var(--color-stone)]">{rating.toFixed(1)}{count > 0 ? ` · ${count} review${count === 1 ? '' : 's'}` : ''}</span>
    </span>
  );
}

function Card({ m }: { m: TeamMember }) {
  const initials = m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-6">
      <div className="flex items-center gap-4">
        {m.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photoUrl} alt={`${m.name}${m.title ? `, ${m.title}` : ''} — K Clinics`} width={80} height={80} loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] font-[family-name:var(--font-display)] text-2xl text-[var(--color-gold-soft)]">{initials}</span>
        )}
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-xl leading-tight">{m.name}</h3>
          {m.title && <p className="text-sm uppercase tracking-[0.12em] text-[var(--color-gold)]">{m.title}</p>}
          {m.yearsExperience ? <p className="mt-0.5 text-xs text-[var(--color-stone)]">{m.yearsExperience}+ years’ experience</p> : null}
        </div>
      </div>

      {m.rating != null && <div className="mt-4"><Stars rating={m.rating} count={m.reviewCount} /></div>}
      {m.credentials && <p className="mt-3 text-xs text-[var(--color-stone-soft)]">{m.credentials}</p>}
      {m.bio && <p className="mt-3 flex-1 text-sm text-[var(--color-ink-soft)]">{m.bio}</p>}

      {m.services.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {m.services.slice(0, 6).map((s) => <span key={s} className="rounded-full bg-[var(--color-porcelain)] px-2.5 py-1 text-xs text-[var(--color-stone)]">{s}</span>)}
        </div>
      )}

      {(m.email || m.phone) && (
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--color-line)] pt-4 text-sm">
          {m.email && <a href={`mailto:${m.email}`} className="text-[var(--color-ink)] hover:text-[var(--color-gold)]">✉ {m.email}</a>}
          {m.phone && <a href={`tel:${m.phone.replace(/\s/g, '')}`} className="text-[var(--color-ink)] hover:text-[var(--color-gold)]">☏ {m.phone}</a>}
        </div>
      )}
    </div>
  );
}
