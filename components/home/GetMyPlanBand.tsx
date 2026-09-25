import { Button, ArrowIcon } from '@/components/ui/Button';
import { KMark } from '@/components/brand/marks';

// Homepage feature band for the AI "Get My Plan" consultation.
export function GetMyPlanBand() {
  // Self-contained card: only a top gap from the marquee — the section below
  // supplies the lower gap, so we don't double-pad and leave a huge void.
  return (
    <section className="container-lux pt-[var(--space-section-sm)]">
      <div className="relative overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-night)] px-7 py-14 text-[var(--color-night-ink)] md:px-14 md:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-80" style={{ background: 'radial-gradient(50% 60% at 85% 30%, rgba(169,138,109,0.18), transparent 70%)' }} />
        <div className="pointer-events-none absolute -right-6 top-1/2 hidden h-[120%] w-[34%] -translate-y-1/2 text-[var(--color-gold,#a98a6d)] opacity-[0.10] md:block">
          <KMark animated />
        </div>
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-gold,#a98a6d)]">New · AI Consultation</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+2.6vw,3.4rem)] leading-[1.05]">Get your personalised treatment plan — in seconds.</h2>
          <p className="mt-5 max-w-xl text-lg text-[var(--color-night-muted)]">Upload a photo and our AI analyses your skin, smile and hair, then builds a phased, dated plan to your budget that you can book in a tap.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button href="/ai-consultation" variant="gold">Get my plan <ArrowIcon /></Button>
            <span className="text-sm text-[var(--color-night-faint)]">Free · cosmetic guidance, not a diagnosis</span>
          </div>
        </div>
      </div>
    </section>
  );
}
