'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// LiveChat is interactive-on-click only, so keep its motion/chat JS off the
// critical path: load it client-side after the page goes idle.
const LiveChat = dynamic(() => import('@/components/chat/LiveChat').then((m) => m.LiveChat), { ssr: false });

export function DeferredLiveChat() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setShow(true), { timeout: 3000 });
    else timer = setTimeout(() => setShow(true), 1500);
    return () => { if (idle != null && w.cancelIdleCallback) w.cancelIdleCallback(idle); if (timer) clearTimeout(timer); };
  }, []);
  return show ? <LiveChat /> : null;
}
