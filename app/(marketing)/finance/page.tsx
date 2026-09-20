import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { Glyph, type GlyphName } from '@/components/ui/Glyph';
import { site } from '@/lib/site';
import { PhoneLink } from '@/components/marketing/PhoneLink';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

// BLD-517: hourly ISR so these mostly-static pages are cached, not full SSR per request.
export const revalidate = 3600;

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Cost & Finance — Ways to Pay | KClinics London',
  description:
    'How to pay at KClinics, Islington: secure online payment, card & contactless, bank transfer or cash, plus spreading the cost with Klarna or Clearpay on eligible treatments.',
  path: '/finance',
  keywords: ['how to pay aesthetics clinic London', 'klarna aesthetic treatments', 'clearpay beauty clinic', 'pay monthly treatments London'],
});

// BLD-1829 — Cost & Finance page rebuild. Content/structure from the owner's
// brief; facts and disclaimers kept intact (this is FCA-adjacent copy about
// third-party payment methods — no claims invented, no caveats dropped).
const WAYS_TO_PAY: { icon: GlyphName; t: string; d: string }[] = [
  {
    icon: 'lock',
    t: 'Secure Online Payment',
    d: 'Pay remotely through our secure payment system, wherever you are. If it’s easier, just ask the team and we’ll send you a secure payment request instead of reading card details over the phone.',
  },
  {
    icon: 'card',
    t: 'Card & Contactless at the Clinic',
    d: 'Every treatment room and the front desk take payment on our card terminal — standard chip & PIN and contactless, whichever you prefer to tap.',
  },
  {
    icon: 'bank',
    t: 'Bank Transfer',
    d: 'Pay directly into the official KClinics company bank account. Our team will give you the correct details and a reference to use.',
  },
  {
    icon: 'cash',
    t: 'Cash',
    d: 'Cash is welcome at the clinic. Your payment is recorded against the relevant appointment, package or course, so your balance always stays accurate.',
  },
];

export default async function FinancePage() {
  const { getPublishedPage } = await import('@/lib/pages');
  const cms = await getPublishedPage('/finance');
  if (cms) {
    const { SectionRenderer } = await import('@/components/cms/SectionRenderer');
    return (<><JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Cost & Finance', path: '/finance' }])} /><SectionRenderer sections={cms} /></>);
  }
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Cost & Finance', path: '/finance' }])} />
      <PageHero
        eyebrow="Cost & finance"
        title="Clear pricing. Flexible ways to pay."
        lede="Cost should be clear from the very first conversation. Treatment prices are shown across the site wherever we can, and where the right price depends on the area treated or the plan you choose, our team confirms it with you after your consultation — no surprises."
        gradient={['#3d352f', '#a98a6d']}
      >
        <div className="flex flex-wrap gap-3">
          <Button href="/pricing" variant="gold">See the full price list <ArrowIcon /></Button>
          <Button href="/contact" variant="outline">Ask us a question</Button>
        </div>
      </PageHero>

      {/* Ways to Pay */}
      <section className="container-lux section">
        <Reveal>
          <p className="eyebrow mb-3">Ways to pay</p>
          <h2 className="text-title">Pay however suits you.</h2>
          <p className="mt-3 max-w-2xl text-[var(--color-ink-soft)]">Whether you’re booking ahead or settling up on the day, there’s a straightforward way to pay that works for you.</p>
        </Reveal>
        <Stagger className="mt-10 grid gap-6 md:grid-cols-2">
          {WAYS_TO_PAY.map((w) => (
            <StaggerItem key={w.t}>
              <div className="h-full rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-porcelain)] text-[var(--color-gold-deep)]">
                  <Glyph name={w.icon} className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl">{w.t}</h3>
                <p className="mt-2 leading-relaxed text-[var(--color-ink-soft)]">{w.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal delay={0.1}>
          <p className="mt-8 max-w-2xl rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-5 py-4 text-sm text-[var(--color-stone)]">
            For your safety, only ever use bank details given to you directly by KClinics — never account numbers or payment links from an unexpected call, text or email claiming to be us.
          </p>
        </Reveal>
      </section>

      {/* Spread the Cost with Klarna or Clearpay */}
      <section className="bg-[var(--color-bone)] section">
        <div className="container-lux">
          <Reveal>
            <p className="eyebrow mb-3">Spread the cost</p>
            <h2 className="text-title">Spread the cost with Klarna or Clearpay.</h2>
            <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">On eligible treatments, packages and KClinics Academy courses, you may be able to spread the cost with Klarna or Clearpay. Instead of paying in full today, these may let you divide the cost into smaller payments — subject to the provider’s own terms, eligibility checks and approval decision.</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-10 rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 md:p-12">
              <div className="flex flex-wrap items-center justify-center gap-5">
                <Image src="/treatments/Klarna.svg" alt="Klarna" width={84} height={58} className="h-14 w-auto" />
                {/* TODO: replace with the official Clearpay logo asset once supplied — public/treatments/ has no Clearpay mark today */}
                <span className="inline-flex h-14 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] px-7 font-[family-name:var(--font-display)] text-xl text-[var(--color-ink)]">
                  Clearpay
                </span>
              </div>
              <p className="mx-auto mt-8 max-w-xl text-center text-sm text-[var(--color-stone)]">
                Klarna and Clearpay are independent payment providers, not KClinics. Eligibility, payment schedules and approval are determined entirely by the provider — we can’t guarantee approval or specific terms. Please review the provider’s own terms before you commit.
              </p>
              <div className="mt-7 flex justify-center">
                <Button href="/pricing" variant="outline">See eligible treatments & courses</Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Card on File & Booking Security */}
      <section className="container-lux section">
        <Reveal>
          <div className="grid gap-8 rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 md:p-12 lg:grid-cols-[auto_1fr] lg:items-start">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--color-porcelain)] text-[var(--color-gold-deep)]">
              <Glyph name="calendar-check" className="h-7 w-7" />
            </div>
            <div>
              <p className="eyebrow mb-3">Booking security</p>
              <h2 className="text-title">Card on file & booking security.</h2>
              <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">To secure certain appointments, we may ask you to add a valid card to your KClinics account when you book. Your card is stored securely by our payment provider, not by us.</p>
              <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">Adding a card does not mean a payment is automatically taken. It secures your booking and supports our cancellation and no-show policy. Where required, you can add or update a card through your account, or via a secure link sent by our team — we will only ever charge your card in line with the booking, cancellation and no-show terms we’ve shared with you.</p>
              <Link href="/info/cancellations-refunds" className="link-underline mt-5 inline-flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
                Read our Cancellations & Refunds policy <ArrowIcon className="text-[var(--color-gold-deep)]" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Need Help With Payment? */}
      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] p-8 text-center md:p-12">
            <h2 className="text-title">Need help with payment?</h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--color-stone)]">
              Before you go any further, our team can talk you through payment methods, packages and how to spread the cost. Call <PhoneLink className="link-underline font-medium text-[var(--color-ink)]" /> or email <a href={site.emailHref} className="link-underline font-medium text-[var(--color-ink)]">{site.email}</a>.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button href="/contact" variant="gold">Contact KClinics <ArrowIcon /></Button>
              <Button href="/pricing" variant="outline">View treatments & prices</Button>
              <Button href="/academy" variant="outline">Explore KClinics Academy</Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
