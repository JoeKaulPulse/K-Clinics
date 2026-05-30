'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Global motion config. `reducedMotion="user"` makes framer-motion honour the
 * user's reduced-motion preference automatically (transforms disabled, opacity
 * kept) — without components having to branch their *rendered output* on the
 * preference, which is what caused server/client hydration mismatches.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
