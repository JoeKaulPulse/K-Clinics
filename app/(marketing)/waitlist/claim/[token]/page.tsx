import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { crmEnabled } from '@/lib/crm';
import { site } from '@/lib/site';
import { fmtClinicDate, fmtClinicTime } from '@/lib/clinic-time';

export const dynamic = 'force-dynamic';

// BLD-133 phase 2 — the one-click claim landing page. A waitlisted client clicks
// "Claim this slot" in their email and lands here; if the offer is still live and
// the slot is genuinely free, we send them into the booking flow on the offered
// day with the claim token attached. Lapsed offers expire + rotate to the next
// person, so the link never books on top of someone else.
export const metadata: Metadata = { title: 'Claim your slot — KClinics', robots: { index: false, follow: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHero eyebrow="Waitlist" title="Your slot." lede="A space opened up for you — let's get you booked in." gradient={['#7b6a5d', '#2a2420']} />
      <section className="container-lux section">
        <Reveal>
          <div className="mx-auto max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 text-center">
            {children}
          </div>
        </Reveal>
      </section>
    </>
  );
}

const callUs = (
  <p className="mt-5 text-sm text-[var(--color-stone)]">
    Need a hand? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.
  </p>
);

export default async function ClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!crmEnabled) {
    return <Shell><h2 className="text-title">Booking is briefly unavailable</h2><p className="mt-3 text-[var(--color-ink-soft)]">Please call us and we’ll book you straight in.</p>{callUs}</Shell>;
  }

  const { lookupClaim } = await import('@/lib/waitlist');
  const result = await lookupClaim(token).catch(() => ({ state: 'invalid' as const }));

  if (result.state === 'ok') {
    const { entry } = result;
    const dateStr = entry.offeredStart.toISOString().slice(0, 10);
    const href = `/book?treatment=${encodeURIComponent(entry.treatmentSlug)}&date=${dateStr}&wl=${encodeURIComponent(token)}`;
    const when = `${fmtClinicDate(entry.offeredStart, { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmtClinicTime(entry.offeredStart)}`;
    return (
      <Shell>
        <p className="eyebrow mb-2">Available now</p>
        <h2 className="text-title">{entry.treatmentTitle}</h2>
        <p className="mt-2 text-lg text-[var(--color-ink-soft)]">{when}</p>
        <p className="mt-4 text-sm text-[var(--color-stone)]">It’s yours to claim before anyone else on the waitlist. Tap below to confirm your details and secure it — your card is only charged when your treatment is delivered.</p>
        <a href={href} className="mt-6 inline-block rounded-full bg-[var(--color-ink)] px-7 py-3 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)]">Book this slot</a>
      </Shell>
    );
  }

  const messages: Record<Exclude<typeof result.state, 'ok'>, { title: string; body: string }> = {
    taken: { title: 'That slot was just taken', body: 'Sorry — someone booked it moments ago. You’re still on the waitlist and we’ll email you the moment the next space opens.' },
    expired: { title: 'This offer has expired', body: 'The window to claim this slot has passed, so we’ve offered it to the next person on the list. You’re still on the waitlist for the next opening.' },
    claimed: { title: 'Already booked', body: 'This slot has already been claimed. If that was you, see you soon! Otherwise, you’re still on the waitlist.' },
    gone: { title: 'This offer is no longer active', body: 'You’re still on the waitlist and we’ll email you when the next matching space opens.' },
    invalid: { title: 'We couldn’t find that offer', body: 'This claim link doesn’t look right. If you were emailed a slot, try the link again — or browse our live availability.' },
  };
  const m = messages[result.state];
  return (
    <Shell>
      <h2 className="text-title">{m.title}</h2>
      <p className="mt-3 text-[var(--color-ink-soft)]">{m.body}</p>
      <a href="/book" className="mt-6 inline-block rounded-full bg-[var(--color-ink)] px-7 py-3 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-gold)]">See live availability</a>
      {callUs}
    </Shell>
  );
}
