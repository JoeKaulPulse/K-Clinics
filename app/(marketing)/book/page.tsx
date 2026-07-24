import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { site } from '@/lib/site';
import { getSiteConfig } from '@/lib/site-config';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';
import { getReviewAggregate } from '@/lib/reviews-aggregate';
import { Stars } from '@/components/ui/Stars';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Book an Appointment — Islington, London | KClinics',
  description:
    'Book your appointment at KClinics, Islington. Create your free account for 15% off your first visit, choose your treatment and time; your card is saved securely and only charged when your service is delivered. Free cancellation up to 24 hours before.',
  path: '/book',
  keywords: ['book appointment London', 'aesthetics booking Islington', 'clinic online booking'],
});

export const dynamic = 'force-dynamic';

export default async function BookPage({ searchParams }: { searchParams: Promise<{ treatment?: string; date?: string; wl?: string }> }) {
  const { treatment, date, wl } = await searchParams;
  // A waitlist claim link arrives as ?treatment=slug&date=YYYY-MM-DD&wl=token —
  // pre-fill the offered day and carry the claim token so completing the booking
  // retires the offer (BLD-133 phase 2).
  const preselectDate = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? (date as string) : '';
  const waitlistToken = wl && /^[A-Za-z0-9-]{1,64}$/.test(wl) ? wl : '';

  // Real review aggregate (BLD-573), same source as the homepage; PRJ-1034.7
  // surfaces it here too, next to the booking CTA. getReviewAggregate() never
  // throws (it swallows source failures internally), so no extra guard needed.
  //
  // BLD-1031: the review aggregate, the catalogue+offers load, and the
  // signed-in client personalisation are three independent data stages —
  // none reads another's output — so they're kicked off together and
  // awaited as a batch instead of one after another. Each stage keeps its
  // original try/catch and default/degraded fallback; only the *scheduling*
  // changed.
  type CatItem = Awaited<ReturnType<(typeof import('@/lib/services'))['bookingCatalogue']>>[number];
  type ClientInfo = { signedIn: boolean; firstName: string; email: string; gender: string | null; smsReminders: boolean; hasPhone: boolean; welcomeEligible: boolean };

  const loadAggregate = async () => getReviewAggregate();

  const loadCatalogue = async (): Promise<{ catalogue: CatItem[]; promoted: Awaited<ReturnType<(typeof import('@/lib/services'))['liveOffers']>>; degraded: boolean }> => {
    let catalogue: CatItem[] = [];
    let promoted: Awaited<ReturnType<(typeof import('@/lib/services'))['liveOffers']>> = [];
    let degraded = false;
    try {
      const { bookingCatalogue, liveOffers } = await import('@/lib/services');
      const { withDbRetry } = await import('@/lib/db');

      // The catalogue is the one thing the page can't render without — load it with
      // a couple of quick retries so a transient DB blip (cold start / connection
      // spike) doesn't drop the whole widget to the "call us" fallback. Offers are
      // best-effort: if they fail we simply don't show the promo strip.
      const [catalogueAll, promotedLive] = await Promise.all([
        withDbRetry(() => bookingCatalogue()),
        withDbRetry(() => liveOffers(true)).catch(() => [] as typeof promoted),
      ]);
      promoted = promotedLive;

      // Dentistry isn't bookable until a GDC-registered dentist is in post —
      // including dental consultations. Exclude the whole dentistry category (not
      // just known dentistry treatment slugs) so a stray dental consultation
      // service can't be booked directly; it routes to "register interest".
      catalogue = (await getSiteConfig()).dentistryLive ? catalogueAll : await (async () => {
        const { dentistry } = await import('@/lib/treatments');
        const dentistrySlugs = new Set(dentistry.map((t) => t.slug));
        return catalogueAll.filter((s) => s.category !== 'dentistry' && !dentistrySlugs.has(s.treatmentSlug));
      })();
    } catch (e) {
      console.error('[book] catalogue load failed — showing call-us fallback:', (e as Error)?.message);
      degraded = true;
    }
    return { catalogue, promoted, degraded };
  };

  // Signed-in personalisation is best-effort and must never break the page or
  // trigger the fallback — if the client lookup blips, we just render the
  // signed-out flow (they can still book). It no longer waits on the
  // catalogue's outcome: if the catalogue ends up degraded, this result is
  // simply unused by the render below (see the `degraded` branch).
  const loadClientInfo = async (): Promise<ClientInfo> => {
    let clientInfo: ClientInfo = { signedIn: false, firstName: '', email: '', gender: null, smsReminders: false, hasPhone: false, welcomeEligible: true };
    try {
      const { getCurrentClient } = await import('@/lib/client-auth');
      const { db } = await import('@/lib/db');
      const client = await getCurrentClient();
      if (client) {
        const active = await db.discountClaim.findFirst({ where: { clientId: client.id, status: 'ACTIVE' } });
        clientInfo = { signedIn: true, firstName: client.firstName, email: client.email, gender: client.gender ?? null, smsReminders: client.smsReminders, hasPhone: !!client.phone, welcomeEligible: !!active };
      }
    } catch (e) {
      console.error('[book] client personalisation skipped (non-fatal):', (e as Error)?.message);
    }
    return clientInfo;
  };

  const [aggregate, { catalogue, promoted, degraded }, clientInfo] = await Promise.all([
    loadAggregate(),
    loadCatalogue(),
    loadClientInfo(),
  ]);
  const rating = aggregate ? { average: aggregate.average, count: aggregate.count } : null;
  const testimonialCards = aggregate?.cards.slice(0, 2) ?? [];

  const points = [
    'Create your free account for 15% off your first visit',
    'Your card is saved securely — no payment is taken now',
    'You’re only charged when your treatment is delivered',
    'Free cancellation up to 24 hours before your appointment',
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Book', path: '/book' }])} />
      <PageHero
        eyebrow="Booking"
        title="Reserve your appointment."
        lede="Choose your treatment and a time that suits you — sign in or add your details when you’re ready to confirm. You won’t pay a penny until your treatment is delivered."
        gradient={['#7b6a5d', '#2a2420']}
      />

      <section className="container-lux section grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-4">How it works</p>
            <h2 className="text-title">Effortless, and entirely on your terms.</h2>
            <ul className="mt-8 space-y-4">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[var(--color-ink-soft)]">
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[var(--color-gold-soft)]">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            {rating && rating.count > 0 && (
              <Link href="/reviews" className="mt-8 flex items-center gap-2.5">
                <Stars rating={rating.average} size="h-4 w-4" />
                <span className="text-sm font-medium text-[var(--color-ink)]">{rating.average.toFixed(1)}</span>
                <span className="text-sm text-[var(--color-stone)]">
                  from {rating.count} verified review{rating.count === 1 ? '' : 's'}
                </span>
              </Link>
            )}
            {testimonialCards.length > 0 && (
              <div className="mt-5 space-y-4">
                {testimonialCards.map((c, i) => (
                  <blockquote key={i} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
                    <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">“{c.body}”</p>
                    <footer className="mt-3 text-xs font-medium text-[var(--color-gold-deep)]">
                      {c.author}{c.treatment ? ` · ${c.treatment}` : ''}
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
            {promoted.length > 0 && (
              <div className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/8 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold-deep)]">On now</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-soft)]">
                  {promoted.slice(0, 4).map((o) => (
                    <li key={o.id}>✦ {o.name}{o.percentOff ? ` — ${o.percentOff}% off` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-8 text-sm text-[var(--color-stone)]">
              Prefer to talk? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          {degraded || catalogue.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
              <h2 className="text-title">Booking is briefly unavailable</h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">We’re sorry — online booking is temporarily down. Please call us and we’ll book you straight in.</p>
              <a href={site.phoneHref} className="mt-5 inline-block rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-[var(--color-porcelain)]">Call {site.phone}</a>
            </div>
          ) : (
            <BookingFlow catalogue={catalogue} client={clientInfo} preselect={treatment ? (catalogue.find((s) => s.treatmentSlug === treatment)?.id ?? null) : null} preselectDate={preselectDate} waitlistToken={waitlistToken} />
          )}
        </Reveal>
      </section>
    </>
  );
}
