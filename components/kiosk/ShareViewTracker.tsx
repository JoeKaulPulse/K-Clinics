'use client';

import { useEffect } from 'react';
import { trackViewItem } from '@/lib/analytics-events';

// BLD-1624: fires a consent-gated GA4 view_item + Meta ViewContent once per
// mount on the public kiosk share-result page, so a visitor arriving from a
// friend's shared link enters the remarketing audience.
//
// Deliberately NOT trackLead(): every other trackLead() call site in the app is
// an actual lead action (form submitted, phone tapped, WhatsApp opened, account
// created). generate_lead / Meta Lead are conversion events imported into
// Google Ads and used by Meta for lead-optimised delivery — firing them on a
// passive page view would inflate the lead count and feed bidding a signal that
// is not a lead. ViewContent is the retargeting event this page actually wants.
//
// The share slug is not sent as an event parameter: it is a bearer-ish share
// token, and a per-slug content_id would fragment the Meta audience into one
// id per card. Renders nothing.
export function ShareViewTracker() {
  useEffect(() => {
    trackViewItem({ id: 'kiosk-share', name: 'Skin & Smile score card', category: 'kiosk' });
  }, []);
  return null;
}
