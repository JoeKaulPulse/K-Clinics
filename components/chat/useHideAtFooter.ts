'use client';

import { useEffect, useState } from 'react';

// The floating contact launchers (WhatsApp on mobile, Live chat on desktop) sit
// at `bottom-5 right-5`. When the user reaches the footer they overlap the access
// badges + legal/copyright line in the bottom-right (BLD-556). Fade them out while
// the footer is in view — the footer already carries phone/email/contact, so the
// CTA isn't needed there and nothing is lost.
export function useHideAtFooter(): boolean {
  const [atFooter, setAtFooter] = useState(false);
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setAtFooter(entry.isIntersecting), { threshold: 0 });
    io.observe(footer);
    return () => io.disconnect();
  }, []);
  return atFooter;
}
