'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getConsent, type ConsentValue } from '@/components/legal/CookieConsent';

// Marketing/analytics pixels — loaded only after the visitor opts in via the
// cookie banner. GA4 → analytics consent; Google Ads + Meta Pixel → marketing
// consent. Re-evaluates live when consent changes (kc-consent event).
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');

export function TrackingScripts({ ga4Id, googleAdsId, metaPixelId }: { ga4Id: string; googleAdsId: string; metaPixelId: string }) {
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setConsent(getConsent());
    const onConsent = (e: Event) => setConsent((e as CustomEvent<ConsentValue>).detail);
    window.addEventListener('kc-consent', onConsent);
    return () => window.removeEventListener('kc-consent', onConsent);
  }, []);

  const analytics = !!consent?.analytics;
  const marketing = !!consent?.marketing;
  const ga4 = analytics ? safe(ga4Id) : '';
  const ads = marketing ? safe(googleAdsId) : '';
  const meta = marketing ? safe(metaPixelId) : '';
  const firstGtag = ga4 || ads;

  return (
    <>
      {firstGtag && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${firstGtag}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            ${ga4 ? `gtag('config', '${ga4}');` : ''}
            ${ads ? `gtag('config', '${ads}');` : ''}
          `}</Script>
        </>
      )}
      {meta && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${meta}');
            fbq('track', 'PageView');
          `}</Script>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <noscript><img height="1" width="1" style={{ display: 'none' }} src={`https://www.facebook.com/tr?id=${meta}&ev=PageView&noscript=1`} alt="" /></noscript>
        </>
      )}
    </>
  );
}
