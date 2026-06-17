import Link from 'next/link';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { Aurora } from '@/components/ui/Aurora';

/** Split-screen auth chrome: brand panel + form. Used for client + staff auth. */
export function AuthShell({
  children,
  heading,
  sub,
  panelTitle,
  panelPoints,
  eyebrow = 'Client portal',
}: {
  children: React.ReactNode;
  heading: string;
  sub: string;
  panelTitle: string;
  panelPoints: string[];
  eyebrow?: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[var(--color-ink)] p-12 text-[var(--color-porcelain)] lg:flex">
        <Aurora className="opacity-[0.55]" />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_70%_30%,color-mix(in_oklab,var(--color-gold)_28%,transparent),transparent_60%)]"
        />
        {/* Oversized watermark mark for editorial depth. */}
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 h-[26rem] w-[26rem] text-[var(--color-gold)] opacity-[0.07]">
          <KMark animated />
        </span>
        <span className="grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <Link href="/" className="relative z-10 text-[var(--color-porcelain)]">
          <span className="block h-12 w-16">
            <KMark />
          </span>
        </Link>
        <div className="relative z-10 max-w-sm">
          <h2 className="font-[family-name:var(--font-display)] text-[2.6rem] leading-[1.04] tracking-[-0.01em]">{panelTitle}</h2>
          <ul className="mt-8 space-y-3.5 text-[color-mix(in_oklab,var(--color-porcelain)_82%,transparent)]">
            {panelPoints.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--color-gold)_22%,transparent)] text-[var(--color-gold-soft)]">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 h-3 w-32 text-[var(--color-gold-soft)] opacity-70">
          <ClinicsWordmark />
        </div>
      </aside>

      {/* Form side */}
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="eyebrow mb-2">{eyebrow}</p>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.9rem,1.4rem+1.6vw,2.6rem)]">{heading}</h1>
            <p className="mt-2 text-[var(--color-stone)]">{sub}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export const authField =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-4 py-3 text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-stone-soft)] focus:border-[var(--color-gold)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-stone)]';
export const authLabel = 'mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--color-stone)]';
