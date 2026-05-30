'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe reduced-motion preference. Returns `false` during server render and
 * the first client render, then resolves to the real preference after mount.
 *
 * Why: components that branch their *rendered output* on the preference (e.g.
 * `if (reduce) return <div/>`) must produce identical markup on the server and
 * the first client render, or React throws a hydration mismatch and re-renders
 * the whole subtree — which is itself janky. Gating on mount guarantees they
 * match, then updates to the reduced layout a tick later.
 */
export function useReducedMotionSafe(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduce;
}
