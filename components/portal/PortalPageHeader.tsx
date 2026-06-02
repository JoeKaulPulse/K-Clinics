import { Reveal } from '@/components/motion/Reveal';

/**
 * Unified premium header for portal inner pages — eyebrow rule, large Fraunces
 * title, optional subtitle and right-aligned action, closed by a soft gold
 * gradient divider. Replaces the flat eyebrow+h1 headers so every portal page
 * carries the marketing-site polish.
 */
export function PortalPageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <Reveal>
      <header className="mb-9 md:mb-12">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3 inline-flex items-center gap-2.5">
              <span className="h-px w-7 bg-[var(--color-gold)]/60" />
              {eyebrow}
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,1.4rem+2.4vw,3rem)] leading-[1.04] tracking-[-0.01em]">
              {title}
            </h1>
            {subtitle && <p className="mt-3 max-w-xl text-[var(--color-stone)]">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className="mt-7 h-px w-full bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-gold)_45%,transparent),var(--color-line)_30%,transparent)]" />
      </header>
    </Reveal>
  );
}
