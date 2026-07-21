'use client';

import dynamic from 'next/dynamic';

// Client wrapper for the brand intro curtain. The `ssr: false` dynamic import
// keeps the Intro JS off the server-rendered critical path (BLD-685), but
// `next/dynamic` with `ssr: false` is only allowed inside a Client Component —
// under Turbopack it's a hard build error in a Server Component. The marketing
// layout is a Server Component, so the lazy import lives here instead.
const Intro = dynamic(() => import('@/components/motion/Intro').then((m) => m.Intro), { ssr: false });

export function IntroLazy() {
  return <Intro />;
}
