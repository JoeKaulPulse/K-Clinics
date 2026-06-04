import type { ReactElement, SVGProps } from 'react';

// Refined line-art glyphs in brand currentColor — a small, consistent icon set
// that replaces stray emoji across client-facing surfaces. 1.3 stroke, 24-grid.

type Props = SVGProps<SVGSVGElement> & { name: GlyphName };

export type GlyphName =
  | 'camera' | 'bag' | 'gift' | 'cake' | 'cap' | 'sparkle' | 'wave';

const PATHS: Record<GlyphName, ReactElement> = {
  camera: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5V17a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8h12l-.8 11.2a1.5 1.5 0 0 1-1.5 1.4H8.3a1.5 1.5 0 0 1-1.5-1.4z" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9.5" width="16" height="11" rx="1.2" />
      <path d="M4 13.5h16M12 9.5v11" />
      <path d="M12 9.5c-2.5 0-4.5-.4-4.5-2.2S9 4.8 12 9.5zM12 9.5c2.5 0 4.5-.4 4.5-2.2S15 4.8 12 9.5z" />
    </>
  ),
  cake: (
    <>
      <path d="M5 20h14M6 20v-6.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V20" />
      <path d="M6 15.5c1.2 0 1.2 1 2.4 1s1.2-1 2.4-1 1.2 1 2.4 1 1.2-1 2.4-1 1.2 1 2.4 1" />
      <path d="M12 8.5V11M12 6.2v.2" />
    </>
  ),
  cap: (
    <>
      <path d="M12 5 22 9.5 12 14 2 9.5z" />
      <path d="M6 11.2V15c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-3.8" />
    </>
  ),
  sparkle: <path d="M12 3.5c.6 4.4 1.6 5.4 6 6-4.4.6-5.4 1.6-6 6-.6-4.4-1.6-5.4-6-6 4.4-.6 5.4-1.6 6-6z" />,
  wave: (
    <>
      <path d="M8 13.5 6.6 12a1.4 1.4 0 0 1 2-2l2.4 2.4V6.4a1.4 1.4 0 0 1 2.8 0v4.2l.2-3.4a1.4 1.4 0 0 1 2.8.2l-.3 6.1A5.6 5.6 0 0 1 13 19a5.4 5.4 0 0 1-5-5.5z" />
    </>
  ),
};

export function Glyph({ name, className, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden {...rest}>
      {PATHS[name]}
    </svg>
  );
}
