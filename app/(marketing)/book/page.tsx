import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { BookingFlow } from '@/components/booking/BookingFlow';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Book an Appointment — Islington, London | K Clinics',
  description:
    'Book your appointment at K Clinics, Islington. Create your free account for 15% off your first visit, choose your treatment and time; your card is saved securely and only charged when your service is delivered. Free cancellation up to 24 hours before.',
  path: '/book',
  keywords: ['book appointment London', 'aesthetics booking Islington', 'clinic online booking'],
});

export const dynamic = 'force-dynamic';

export default async function BookPage() {
  const { bookingCatalogue, liveOffers } = await import('@/lib/services');
  const { getCurrentClient } = await import('@/lib/client-auth');
  const { db } = await import('@/lib/db');

  const [catalogue, promoted, client] = await Promise.all([
    bookingCatalogue(),
    liveOffers(true),
    getCurrentClient(),
  ]);

  // Welcome offer is available to a signed-in client with an unused claim.
  let welcomeEligible = !client; // not signed in → they’ll get it on signup
  if (client) {
    const active = await db.discountClaim.findFirst({ where: { clientId: client.id, status: 'ACTIVE' } });
    welcomeEligible = !!active;
  }

  const clientInfo = client
    ? { signedIn: true, firstName: client.firstName, email: client.email, gender: client.gender ?? null, smsReminders: client.smsReminders, hasPhone: !!client.phone, welcomeEligible }
    : { signedIn: false, firstName: '', email: '', gender: null as string | null, smsReminders: false, hasPhone: false, welcomeEligible: true };

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
        lede="Create your account, choose your treatment and a time that suits you. You won’t pay a penny until your treatment is delivered."
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
            {promoted.length > 0 && (
              <div className="mt-8 rounded-[var(--radius-md)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/8 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold)]">On now</p>
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
          <BookingFlow catalogue={catalogue} client={clientInfo} />
        </Reveal>
      </section>
    </>
  );
}
