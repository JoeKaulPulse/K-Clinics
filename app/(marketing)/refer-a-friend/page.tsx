import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/ui/PageHero';
import { Reveal } from '@/components/motion/Reveal';
import { Button, ArrowIcon } from '@/components/ui/Button';
import { site } from '@/lib/site';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Refer a Friend — Give £25, Get £25 | K Clinics London',
  description: 'Share K Clinics with a friend: they get £25 off their first treatment and you get £25 credit when they visit. Generous, simple, and automatic.',
  path: '/refer-a-friend',
  keywords: ['refer a friend', 'K Clinics referral', 'aesthetics referral London'],
});

export const dynamic = 'force-dynamic';

const STEPS = [
  { n: '01', t: 'Share your link', d: 'Sign in and grab your unique referral link from your rewards page. Send it to a friend who’d love K Clinics.' },
  { n: '02', t: 'They book their first treatment', d: 'Your friend creates an account and books their first treatment (£100 or more). They keep their 15% welcome discount too.' },
  { n: '03', t: 'You both get £25', d: 'Once their first qualifying treatment is complete, £25 lands automatically for both of you — to spend on your next visit.' },
];

export default async function ReferPage() {
  const { getCurrentClient } = await import('@/lib/client-auth');
  const client = await getCurrentClient().catch(() => null);

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Refer a Friend', path: '/refer-a-friend' }])} />
      <PageHero eyebrow="Refer a friend" title="Give £25, get £25." lede="The best compliment is a recommendation. Share K Clinics with someone you love — they get £25 off their first treatment, and you get £25 to spend on your next." gradient={['#2a2420', '#a98a6d']}>
        {client
          ? <Button href="/account/rewards" variant="gold">Get your referral link <ArrowIcon /></Button>
          : <div className="flex flex-wrap gap-3"><Button href="/account/signup" variant="gold">Create your account <ArrowIcon /></Button><Button href="/account/login" variant="outline">Sign in</Button></div>}
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

      <section className="container-lux section">
        <Reveal>
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-bone)] p-8 md:p-12">
            <h2 className="text-title">Generous by design.</h2>
            <ul className="mt-6 space-y-3 text-[var(--color-ink-soft)]">
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> <span><strong className="text-[var(--color-ink)]">£25 for your friend</strong> — off their very first treatment, on top of their 15% new-client welcome.</span></li>
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> <span><strong className="text-[var(--color-ink)]">£25 for you</strong> — credited automatically once their first qualifying treatment (£100+) is complete.</span></li>
              <li className="flex items-start gap-3"><span className="mt-1 text-[var(--color-gold)]">✦</span> <span><strong className="text-[var(--color-ink)]">No limit</strong> — refer as many friends as you like; the credit stacks for your next visits.</span></li>
            </ul>
            <p className="mt-6 text-sm text-[var(--color-stone)]">Credit is held in your account as reward points (£1 = 100 points) and applied at checkout. Referral rewards apply when the referred friend’s first treatment is £100 or more. Questions? Call <a href={site.phoneHref} className="link-underline font-medium text-[var(--color-ink)]">{site.phone}</a>.</p>
            <div className="mt-8">
              {client ? <Button href="/account/rewards" variant="gold">Share your link <ArrowIcon /></Button> : <Button href="/account/signup" variant="gold">Get started <ArrowIcon /></Button>}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
