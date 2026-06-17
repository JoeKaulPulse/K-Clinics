'use client';

import { SpeedInsights } from '@vercel/speed-insights/next';
import { getConsent } from '@/components/legal/CookieConsent';

// BLD-417: Speed Insights sends real-user metrics (page URL, device, timing) which is
// non-essential analytics under UK GDPR/PECR. beforeSend drops every beacon until the
// visitor has consented to analytics cookies, so nothing is collected pre-consent.
export function ConsentedSpeedInsights() {
  return <SpeedInsights beforeSend={(data) => (getConsent()?.analytics ? data : null)} />;
}
