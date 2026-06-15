'use client';

import { useEffect, useState } from 'react';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Registers the academy service worker and offers an "Install" button when the
// browser allows it (Chrome/Android/desktop). On iOS Safari — which has no
// install event — it shows the Add-to-Home-Screen hint instead. Renders nothing
// once installed / running standalone.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/academy-sw.js').catch(() => {});

    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) { setHidden(true); return; }

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua)) setIosHint(true);

    return () => { window.removeEventListener('beforeinstallprompt', onBIP); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (hidden) return null;

  if (deferred) {
    return (
      <button
        onClick={async () => { await deferred.prompt(); try { await deferred.userChoice; } catch { /* */ } setDeferred(null); setHidden(true); }}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-[var(--color-porcelain)] transition-colors hover:bg-[var(--color-espresso)]"
      >
        📲 Install the K Academy app
      </button>
    );
  }

  if (iosHint) {
    return <p className="text-xs text-[var(--color-stone)]">Add to your home screen: tap <span className="font-medium">Share</span>, then <span className="font-medium">Add to Home Screen</span>.</p>;
  }

  return null;
}
