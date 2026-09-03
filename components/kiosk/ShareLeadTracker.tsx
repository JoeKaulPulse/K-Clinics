'use client';

import { useEffect } from 'react';
import { trackLead } from '@/lib/analytics-events';

// BLD-1624: fires a consent-gated GA4 generate_lead + Meta Lead once per mount
// on the public kiosk share-result page — the whole point of that page is a
// friend's shared link bringing in a new visitor, which is exactly the top-of-
// funnel signal these pixels are for. Mirrors ViewItemTracker's pattern.
// Renders nothing.
export function ShareLeadTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackLead({ detail: { content_name: 'kiosk_share', slug } });
    // Re-fire only when the viewed share result actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return null;
}
