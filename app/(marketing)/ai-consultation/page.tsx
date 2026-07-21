import type { Metadata } from 'next';
import Link from 'next/link';
import { KVision } from '@/components/ai/KVision';
import { pageMeta, JsonLd, breadcrumbLd } from '@/lib/seo';
import { NewsletterCapture } from '@/components/layout/NewsletterCapture';

export const generateMetadata = (): Promise<Metadata> => pageMeta({
  title: 'Get My Plan — AI Skin, Smile & Hair Consultation | KClinics',
  description:
    'Upload a photo and our AI analyses your skin, smile and hair, then builds a personalised, phased, bookable treatment plan to your budget. Free with a KClinics account.',
  path: '/ai-consultation',
  keywords: ['AI skin analysis London', 'AI consultation aesthetics', 'personalised treatment plan'],
});

export const dynamic = 'force-dynamic';

export default async function AiConsultationPage() {
  const { getCurrentClient } = await import('@/lib/client-auth');
  const { getSetting } = await import('@/lib/settings');
  const [client, enabled] = await Promise.all([getCurrentClient().catch(() => null), getSetting('ai_consultation_enabled').catch(() => true)]);

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Get My Plan', path: '/ai-consultation' }])} />
      <KVision signedIn={!!client} firstName={client?.firstName ?? ''} enabled={enabled} />

      {/* How it works — three steps. Static + server-rendered so it's visible on
          the landing page and indexable (BLD-555). */}
      <section className="container-lux section">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl">A clinician-grade plan in three steps</h2>
        </div>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            { n: '1', t: 'Upload a photo', d: 'A clear, front-on photo of your face, skin, smile, hair or body in soft, even light. Never intimate areas. Add up to four.' },
            { n: '2', t: 'Our AI analyses it', d: 'It reads concerns across skin, smile and hair and matches them to our treatments — cosmetic guidance, not a medical diagnosis.' },
            { n: '3', t: 'Get a plan you can book', d: 'A phased, dated plan built to your budget, with prices and Clearpay — book any step in a tap. A clinician confirms everything in clinic.' },
          ].map((s) => (
            <li key={s.n} className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-7">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-ink)] font-[family-name:var(--font-display)] text-lg text-[var(--color-porcelain)]">{s.n}</span>
              <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Photos & privacy — explicit transparency for processing facial images
          (UK GDPR special-category data). Wording matches the actual handling in
          lib/ai-consultation.ts: encrypted at rest, stored only if you opt in. */}
      <section className="bg-[var(--color-bone)]">
        <div className="container-narrow section">
          <p className="eyebrow">Your photos &amp; privacy</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl">What happens to your photo</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {[
              { t: 'Used to build your plan', d: 'Your photo is analysed to generate your personalised guidance and plan. This is cosmetic guidance only — not a medical diagnosis — and is always confirmed by a clinician at your in-clinic consultation and patch test.' },
              { t: 'Encrypted, and saved only if you choose', d: 'Photos are encrypted. They are saved to your clinical record only if you tick “save my photos” so your clinician can see them. If you leave it unticked, your photo is used for the analysis and not kept on your record.' },
              { t: 'Special-category data, treated as such', d: 'Facial and body images are sensitive personal data under UK GDPR. We process them on the basis of your explicit consent, which we record with a timestamp, and never for advertising.' },
              { t: 'You stay in control', d: 'You can download everything we hold about you, or ask us to delete it, at any time from your account or by contacting us. We never sell your data.' },
            ].map((b) => (
              <div key={b.t} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
                <h3 className="font-[family-name:var(--font-display)] text-lg">{b.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-stone)]">{b.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-[var(--color-stone)]">
            Full detail is in our <Link href="/info/website-privacy-terms" className="link-underline font-medium text-[var(--color-ink)]">privacy policy</Link>. Questions? Email <a href="mailto:support@kclinics.co.uk" className="link-underline font-medium text-[var(--color-ink)]">support@kclinics.co.uk</a>.
          </p>
        </div>
      </section>
      <NewsletterCapture source="ai-consultation" />
    </>
  );
}
