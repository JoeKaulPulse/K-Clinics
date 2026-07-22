'use client';

import { useEffect, useState } from 'react';

// The floating contact launchers (WhatsApp on mobile, Live chat on desktop) sit
// at `bottom-5 right-5`. When the user reaches the footer they overlap the access
// badges + legal/copyright line in the bottom-right (BLD-556). Fade them out while
// the footer is in view — the footer already carries phone/email/contact, so the
// CTA isn't needed there and nothing is lost.
//
// The IntersectionObserver alone regressed (PRJ-1034.10): its threshold didn't
// reliably hold `atFooter=true` at the exact resting scroll position once the
// user was fully scrolled to the bottom of the page (rubber-band settle, a
// resize collapsing the mobile address bar, etc). This now also checks the
// scroll position directly as a fallback/supplement: if the viewport bottom is
// within the button's own footprint of the page's true bottom, force the
// hidden state regardless of what the observer last reported.
const BOTTOM_SAFE_ZONE_PX = 96; // button height + bottom-5 offset + margin

function isNearPageBottom(): boolean {
  if (typeof window === 'undefined') return false;
  const scrollBottom = window.scrollY + window.innerHeight;
  const pageHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  return scrollBottom >= pageHeight - BOTTOM_SAFE_ZONE_PX;
}

export function useHideAtFooter(): boolean {
  const [atFooter, setAtFooter] = useState(false);

  useEffect(() => {
    const footer = document.querySelector('footer');
    let footerIntersecting = false;
    const recompute = () => setAtFooter(footerIntersecting || isNearPageBottom());

    let io: IntersectionObserver | undefined;
    if (footer && typeof IntersectionObserver !== 'undefined') {
      // Negative bottom rootMargin so the observer fires slightly before the
      // footer's top edge reaches the very bottom of the viewport — covering
      // the button's own height rather than only the instant of first overlap.
      io = new IntersectionObserver(
        ([entry]) => {
          footerIntersecting = entry.isIntersecting;
          recompute();
        },
        { threshold: 0, rootMargin: `0px 0px -${BOTTOM_SAFE_ZONE_PX}px 0px` },
      );
      io.observe(footer);
    }

    window.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    recompute();

    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, []);

  return atFooter;
}
