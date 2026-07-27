'use client';

import { useEffect, useState } from 'react';
import { getConsent, type ConsentValue } from '@/components/legal/CookieConsent';

// BLD-1009: the Google Maps iframe sets third-party cookies, so — like the
// Google Ads/Meta pixels in TrackingScripts.tsx — it only loads after the
// visitor has given marketing consent. Before that, show a placeholder with
// a direct link to Google Maps and a way to reopen the cookie banner.
export function ConsentGatedMap({ src, mapLink, className }: { src: string; mapLink: string; className: string }) {
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setConsent(getConsent());
    const onConsent = (e: Event) => setConsent((e as CustomEvent<ConsentValue>).detail);
    window.addEventListener('kc-consent', onConsent);
    return () => window.removeEventListener('kc-consent', onConsent);
  }, []);

  if (consent?.marketing) {
    return <iframe title="KClinics location map" src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className={className} />;
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 bg-[var(--color-bone)] p-8 text-center ${className}`}>
      <p className="text-sm text-[var(--color-stone)]">Accept cookies to view the map, or open it directly.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('kc-open-consent'))}
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-porcelain)]"
        >
          Cookie settings
        </button>
        <a href={mapLink} target="_blank" rel="noopener noreferrer" className="link-underline text-sm font-medium text-[var(--color-gold-deep)]">
          Open in Google Maps →
        </a>
      </div>
    </div>
  );
}
