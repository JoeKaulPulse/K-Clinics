'use client';

import { useEffect } from 'react';
import { trackViewItem } from '@/lib/analytics-events';

// BLD-842: fires a consent-gated GA4 view_item + Meta ViewContent once per
// mount, from server-rendered detail pages (treatments, packages). Renders
// nothing.
export function ViewItemTracker({ id, name, category, valuePence }: { id: string; name: string; category?: string; valuePence?: number }) {
  useEffect(() => {
    trackViewItem({ id, name, category, valuePence });
    // Re-fire only when the viewed item actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
}
