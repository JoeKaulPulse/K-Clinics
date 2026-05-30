'use client';

import { motion } from 'motion/react';

/** Animates a heading word-by-word with a soft mask rise — for hero titles.
 *  Reduced-motion is handled globally by MotionConfig (transforms disabled),
 *  so the rendered structure stays identical on server and client. */
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
          <motion.span
            className="inline-block"
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{ duration: 1, delay: delay + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
