/**
 * Brand-styled vector access badges — replacements for the old raster
 * "wheelchair access" / "pre-pay parking" PNGs. Pure SVG, available as a
 * `light` or `dark` variant so they sit cleanly on either surface while
 * staying within the brand palette. No external images.
 */

type Tone = 'light' | 'dark';

const TONE: Record<Tone, { chip: string; icon: string; title: string; sub: string }> = {
  // For dark surfaces (e.g. the footer).
  dark: {
    chip: 'border-white/15 bg-white/[0.04] text-[var(--color-porcelain)]',
    icon: 'bg-[var(--color-gold-soft)] text-[var(--color-ink)]',
    title: 'text-[var(--color-porcelain)]',
    sub: 'text-[color-mix(in_oklab,var(--color-porcelain)_60%,transparent)]',
  },
  // For light surfaces (e.g. the Our Clinics page).
  light: {
    chip: 'border-[var(--color-line)] bg-[var(--color-porcelain)] text-[var(--color-ink)]',
    icon: 'bg-[var(--color-ink)] text-[var(--color-gold-soft)]',
    title: 'text-[var(--color-ink)]',
    sub: 'text-[var(--color-stone)]',
  },
};

function Badge({ icon, title, sub, t }: { icon: React.ReactNode; title: string; sub: string; t: (typeof TONE)[Tone] }) {
  return (
    <span className={`inline-flex items-center gap-2.5 rounded-full border py-1.5 pl-2 pr-4 ${t.chip}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t.icon}`}>{icon}</span>
      <span className="leading-tight">
        <span className={`block text-[0.7rem] font-semibold uppercase tracking-[0.08em] ${t.title}`}>{title}</span>
        <span className={`block text-[0.62rem] uppercase tracking-[0.12em] ${t.sub}`}>{sub}</span>
      </span>
    </span>
  );
}

const WheelchairIcon = (
  <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="9" cy="3.4" r="1.5" fill="currentColor" stroke="none" />
    <path d="M8.4 6v5.2h4.7l2.5 5.1" />
    <path d="M8.6 9.4a5 5 0 1 0 4.3 7.3" />
    <path d="M15.6 16.3l1.9.1-.4 2.4" />
  </svg>
);

const ParkingIcon = (
  <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8.5 18V6h4.1a3.2 3.2 0 0 1 0 6.4H8.5" />
  </svg>
);

export function AccessBadges({ className = '', tone = 'dark' }: { className?: string; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      <Badge icon={WheelchairIcon} title="Wheelchair access" sub="Step-free entrance" t={t} />
      <Badge icon={ParkingIcon} title="Pre-pay parking" sub="Car parks nearby" t={t} />
    </div>
  );
}
