import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Stagger, StaggerItem, Reveal } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Special Offers & Savings | KClinics London',
  description:
    'Current offers at KClinics, Islington — 15% off your first visit, complimentary consultations, refer-a-friend rewards, gift vouchers and savings on treatment packages.',
  path: '/offers',
  keywords: ['aesthetics offers London', 'first visit discount clinic', 'treatment package savings'],
});

const OFFERS = [
  { tag: 'New clients', t: '15% off your first visit', d: 'Create an account and enjoy 15% off your first treatment — our welcome to KClinics.', href: '/book', cta: 'Book your first visit' },
  { tag: 'Always free', t: 'Complimentary consultations', d: 'Every journey begins with a no-obligation consultation and honest, expert advice — never a fee.', href: '/consultation', cta: 'Book a consultation' },
  { tag: 'Give £25, get £25', t: 'Refer a friend', d: 'Share KClinics with someone you love — they get £25 off their first treatment, and so do you.', href: '/refer-a-friend', cta: 'How it works' },
  { tag: 'Better together', t: 'Package & course savings', d: 'Our curated packages bundle complementary treatments for better results — and better value.', href: '/packages', cta: 'Explore packages' },
  { tag: 'Beauty Points', t: 'Earn as you go', d: 'Collect points on every visit, plus bonuses for reviews, birthdays and referrals — redeemable as money off.', href: '/membership', cta: 'Discover rewards' },
  { tag: 'The perfect gift', t: 'Gift vouchers', d: 'Treat someone to a voucher for any amount — redeemable across our entire menu, valid for 12 months.', href: '/gift-vouchers', cta: 'Buy a voucher' },
];

export default function OffersPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Special Offers', path: '/offers' }])} />
      <PageHero
        eyebrow="Special offers"
        title="Considered care, rewarded."
        lede="We’d rather offer genuine, lasting value than gimmicks. Here’s how to make the most of KClinics — from your very first visit onwards."
        gradient={['#a98a6d', '#3d352f']}
      />

      <section className="container-lux section">
        <h2 className="sr-only">Our current offers</h2>
        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {OFFERS.map((o) => (
            <StaggerItem key={o.t}>
              <div className="flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 transition-all duration-700 [transition-timing-function:var(--ease-lux)] hover:-translate-y-1.5 hover:bg-[var(--color-porcelain)] hover:shadow-[var(--shadow-lift)]">
                <span className="self-start rounded-full bg-[color-mix(in_oklab,var(--color-gold)_18%,transparent)] px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[var(--color-ink)]">{o.tag}</span>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl leading-snug">{o.t}</h3>
                <p className="mt-2 flex-1 leading-relaxed text-[var(--color-ink-soft)]">{o.d}</p>
                <a href={o.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-gold-deep)] hover:underline">{o.cta} →</a>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal>
          <p className="mt-10 text-center text-xs text-[var(--color-stone)]">
            Offers are subject to availability and may be updated. New-client discount applies to your first treatment and can’t be combined with other promotions. See individual pages for full terms.
          </p>
        </Reveal>

        <Reveal>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/book" variant="gold">Book your visit <ArrowIcon /></Button>
            <Button href="/treatments" variant="outline">Explore treatments</Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
