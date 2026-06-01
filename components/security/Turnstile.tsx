'use client';

import { useEffect, useRef } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, opts: any) => string; remove?: (id: string) => void } }
}

/** Cloudflare Turnstile widget. Loads the script once and renders explicitly,
 *  surfacing the verification token via onToken (empty string on error/expiry). */
export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    let cancelled = false;
    function render() {
      if (cancelled || rendered.current || !ref.current || !window.turnstile) return;
      rendered.current = true;
      window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    }
    if (!document.getElementById('cf-turnstile-script')) {
      const s = document.createElement('script');
      s.id = 'cf-turnstile-script';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      render();
    }
    return () => { cancelled = true; };
  }, [siteKey, onToken]);

  return <div ref={ref} className="my-1" />;
}
