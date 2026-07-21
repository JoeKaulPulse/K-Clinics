import { NewsletterForm } from '@/components/layout/NewsletterForm';
import { Aurora } from '@/components/ui/Aurora';
import { Reveal } from '@/components/motion/Reveal';

export function NewsletterCapture({ source }: { source?: string } = {}) {
  return (
    <section className="surface-ink grain relative overflow-hidden">
      <Aurora />
      <div className="container-lux relative py-20 md:py-24">
        <Reveal>
          <div className="mx-auto max-w-xl text-center">
            <p className="eyebrow mb-4 text-[var(--color-gold-soft)]">K Edit</p>
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-porcelain)] md:text-4xl">
              Skincare wisdom, delivered.
            </h2>
            <p className="mt-4 text-[color-mix(in_oklab,var(--color-porcelain)_68%,transparent)]">
              New treatments, seasonal edits and expert skin advice — straight to your inbox. No noise, just what matters.
            </p>
            <div className="mt-8">
              <NewsletterForm source={source} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
