import { Fragment } from 'react';

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
        <Fragment key={i}>
          <span aria-hidden className="inline-block overflow-hidden align-bottom pb-[0.12em]">
            <span className="word-rise inline-block" style={{ animationDelay: `${(delay + i * 0.08).toFixed(2)}s` }}>
              {word}
            </span>
          </span>
          {/* Real space BETWEEN the word boxes (outside the overflow-hidden mask)
              so it isn't clipped — otherwise the words run together. */}
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </Tag>
  );
}
