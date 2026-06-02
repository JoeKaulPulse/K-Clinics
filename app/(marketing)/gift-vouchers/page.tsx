import type { Metadata } from 'next';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { GiftVoucherFlow } from '@/components/gift/GiftVoucherFlow';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Gift Vouchers — Give the Gift of K Clinics | London',
  description: 'Buy a K Clinics gift voucher online in minutes. Choose any amount from £10 to £500, add a personal message, and we’ll email it instantly or on a date you choose.',
  path: '/gift-vouchers',
  keywords: ['K Clinics gift voucher', 'beauty gift card London', 'aesthetics gift voucher', 'gift card Islington clinic'],
});

export const dynamic = 'force-dynamic';

const STEPS = [
  { n: '01', t: 'Choose an amount', d: 'Pick a preset or set any value between £10 and £500 — they’ll spend it however they like.' },
  { n: '02', t: 'Add a personal touch', d: 'Write a short message and choose to send it now or schedule it for the perfect day.' },
  { n: '03', t: 'Delivered by email', d: 'Pay securely and the voucher arrives by email with a unique code, ready to redeem in clinic.' },
];

const USES = ['Skin & facial aesthetics', 'Injectable treatments', 'Aesthetic dentistry', 'Laser & body', 'A complimentary consultation', 'Anything across the menu'];

export default function GiftVouchersPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Gift Vouchers', path: '/gift-vouchers' }])} />
      <PageHero
        eyebrow="Gift vouchers"
        title="Give the gift of confidence."
        lede="A K Clinics voucher is the thoughtful way to treat someone — fully flexible, beautifully presented, and valid across our entire menu of treatments. Buy online in minutes."
        gradient={['#2a2420', '#a98a6d']}
      >
        <a href="#buy" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-gold)] px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-ink)]">Buy a voucher →</a>
      </PageHero>

      <section className="container-lux section">
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div>
                <p className="font-[family-name:var(--font-display)] text-4xl text-[var(--color-gold)]">{s.n}</p>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl">{s.t}</h3>
                <p className="mt-2 text-[var(--color-ink-soft)]">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="buy" className="container-lux section grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-3">Redeemable on everything</p>
            <h2 className="text-title">One voucher, the whole menu.</h2>
            <p className="mt-4 text-[var(--color-ink-soft)]">Vouchers can be put towards any treatment, product or consultation at K Clinics. They’re valid for 12 months, can be used across several visits, and the balance is tracked automatically.</p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {USES.map((u) => (
                <li key={u} className="flex items-start gap-2.5 text-sm text-[var(--color-ink-soft)]"><span className="mt-1 text-[var(--color-gold)]">✦</span> {u}</li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[var(--color-stone)]">Buying for a corporate gift or need a printed card? Call us on <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a> and we’ll arrange it.</p>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <GiftVoucherFlow />
        </Reveal>
      </section>
    </>
  );
}
