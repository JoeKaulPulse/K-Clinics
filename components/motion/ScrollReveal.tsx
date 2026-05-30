'use client';

import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useReducedMotionSafe } from '@/components/motion/use-reduced-motion-safe';

/**
 * Scroll-linked word reveal — the signature award-site effect. As the block
 * scrolls through the viewport, each word fades from faint to full, left to
 * right. Used for editorial statement paragraphs.
 */
export function ScrollReveal({
  children,
  className = '',
  as: Tag = 'p',
}: {
  children: string;
  className?: string;
  as?: 'p' | 'h2' | 'h3' | 'blockquote';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'start 0.3'],
  });

  const words = children.split(' ');

  if (reduce) {
    const Static = Tag as React.ElementType;
    return <Static className={className}>{children}</Static>;
  }

  const Wrapper = Tag as React.ElementType;
  return (
    <Wrapper ref={ref} className={className}>
      <span className="flex flex-wrap">
        {words.map((word, i) => {
          const start = i / words.length;
          const end = start + 1 / words.length;
          return (
            <Word key={i} progress={scrollYProgress} range={[start, end]}>
              {word}
            </Word>
          );
        })}
      </span>
    </Wrapper>
  );
}

function Word({ children, progress, range }: { children: ReactNode; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return (
    <span className="relative mr-[0.28em] mt-[0.1em]">
      <motion.span style={{ opacity }}>{children}</motion.span>
    </span>
  );
}
