import Image from 'next/image';
import { GenerativeArt } from '@/components/ui/GenerativeArt';

/**
 * Renders a real photograph when `src` is provided AND the file exists in
 * /public; otherwise falls back to the generative-art placeholder. This lets
 * the site ship now and adopt real imagery the moment the media files land in
 * public/treatments/ — no code change, no text baked into the image.
 *
 * `src` should be a public path (e.g. /treatments/Botox.png) or null.
 */
export function MediaArt({
  src,
  from,
  to,
  seed = 0,
  alt = '',
  className = '',
  sizes = '(max-width: 768px) 100vw, 50vw',
  priority = false,
}: {
  src: string | null;
  from: string;
  to: string;
  seed?: number;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (src) {
    // `next/image fill` needs a positioned parent. Only add `relative` when the
    // caller hasn't supplied its own positioning (e.g. `absolute inset-0`),
    // otherwise the two position utilities collide and the box collapses.
    const positioned = /(?:^|\s)(absolute|fixed|sticky|relative)(?:\s|$)/.test(className);
    return (
      <div className={`${positioned ? '' : 'relative'} overflow-hidden ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
        {/* Subtle scrim so overlaid live text (never baked) stays legible. */}
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(42,36,32,0.28),transparent_45%)]" />
      </div>
    );
  }
  return <GenerativeArt from={from} to={to} seed={seed} className={className} />;
}
