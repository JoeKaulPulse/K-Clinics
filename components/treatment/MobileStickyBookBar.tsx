'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { site } from '@/lib/site';

// BLD-1609: WhatsAppButton (components/layout/WhatsAppButton.tsx) is the only
// sticky mobile element on the site. TreatmentTemplate's real booking CTA
// (BookingButtons) only appears in the hero and again near the pricing table,
// so a mobile visitor scrolling through benefits/process/FAQ loses the booking
// CTA for most of the page. This adds a slim price + "Book Now" bar, visible
// only while scrolled past the hero and only on mobile.
//
// Mirrors useHideAtFooter's IntersectionObserver approach (components/chat/
// useHideAtFooter.ts) but watches the page's own booking CTAs instead of the
// footer: hidden whenever any element tagged `data-booking-cta` (the hero or
// pricing-table BookingButtons) is on screen, so there's never a visible
// duplicate/overlapping CTA.
export function MobileStickyBookBar({ treatmentSlug, priceLabel }: { treatmentSlug: string; priceLabel: string }) {
  // Assume a real CTA is in view until the observer says otherwise (true on
  // load, since the hero CTA sits right at the top) — avoids a flash of the
  // bar before the observer attaches.
  const [ctaInView, setCtaInView] = useState(true);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll('[data-booking-cta]'));
    if (!targets.length || typeof IntersectionObserver === 'undefined') { setCtaInView(false); return; }
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); }
        setCtaInView(visible.size > 0);
      },
      { threshold: 0.2 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolledPastHero(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const visible = scrolledPastHero && !ctaInView;
  const bookHref = `${site.booking.path}?treatment=${encodeURIComponent(treatmentSlug)}`;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-[var(--color-line)] bg-[var(--color-porcelain)]/95 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur transition-transform duration-300 md:hidden print:hidden ${visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <span className="min-w-0 truncate font-[family-name:var(--font-display)] text-base text-[var(--color-ink)]">{priceLabel}</span>
      <Link
        href={bookHref}
        tabIndex={visible ? undefined : -1}
        className="shrink-0 rounded-full bg-[var(--color-gold-deep)] px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-gold)] transition-colors hover:bg-[var(--color-ink)]"
      >
        Book Now
      </Link>
    </div>
  );
}
