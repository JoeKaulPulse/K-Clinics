'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Subtle fade on every route change, keyed on pathname. Uses opacity only (no
 *  transform), so it's gentle enough to keep even under reduced-motion — and,
 *  crucially, renders identical structure on server and client, avoiding a
 *  hydration mismatch + client-side re-render. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
