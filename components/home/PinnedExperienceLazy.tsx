'use client';

import dynamic from 'next/dynamic';

// PRJ-1118.11: PinnedExperience is a below-fold scrollytelling section built on
// motion/react's useScroll/useTransform — client-only hooks with no useful SSR
// output — so a static import on the homepage shipped the whole animation
// library in the initial JS bundle of the site's highest-traffic page. The
// `ssr: false` dynamic import code-splits it out, but (per IntroLazy.tsx)
// `next/dynamic` with `ssr: false` is only allowed inside a Client Component —
// the homepage is a Server Component, so the lazy import lives here instead.
const PinnedExperience = dynamic(() => import('@/components/home/PinnedExperience').then((m) => m.PinnedExperience), { ssr: false });

export function PinnedExperienceLazy() {
  return <PinnedExperience />;
}
