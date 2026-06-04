/** Animates a heading word-by-word with a soft mask rise — for page titles.
 *  CSS-only (no 'use client', no JS): the animation runs on first paint rather
 *  than waiting for the motion bundle to hydrate, so the LCP heading isn't
 *  blocked. Reduced-motion is handled by the .word-rise rule in globals.css. */
export function WordReveal({
  text,
  className,
  delay = 0,
  as: Tag = 'h1',
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'p' | 'span';
}) {
  const words = text.split(' ');
  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom pb-[0.12em]">
          <span className="word-rise inline-block" style={{ animationDelay: `${(delay + i * 0.08).toFixed(2)}s` }}>
            {word}{i < words.length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </Tag>
  );
}
