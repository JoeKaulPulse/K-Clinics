import { site } from '@/lib/site';

/** K Clinics wordmark — a fine serif "K" monogram inside a hairline ring,
 *  set beside an editorial wordmark. Pure SVG/CSS, scales crisply. */
export function Logo({ className = '', mono = false }: { className?: string; mono?: boolean }) {
  const tone = mono ? 'currentColor' : 'var(--color-gold)';
  return (
    <span className={`inline-flex items-center gap-3 ${className}`} aria-label={site.name}>
      <span className="relative grid h-10 w-10 place-items-center">
        <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="24" cy="24" r="23" fill="none" stroke={tone} strokeWidth="1" opacity="0.55" />
        </svg>
        <span
          className="font-[family-name:var(--font-display)] text-[1.4rem] leading-none"
          style={{ color: mono ? 'currentColor' : 'var(--color-fg)', fontVariationSettings: "'opsz' 144" }}
        >
          K
        </span>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className="font-[family-name:var(--font-display)] text-[1.18rem] tracking-[-0.01em]"
          style={{ fontVariationSettings: "'opsz' 144" }}
        >
          K&nbsp;Clinics
        </span>
        <span
          className="mt-[3px] text-[0.5rem] font-medium uppercase tracking-[0.34em]"
          style={{ color: mono ? 'currentColor' : 'var(--color-gold)' }}
        >
          London
        </span>
      </span>
    </span>
  );
}
