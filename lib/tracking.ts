import 'server-only';
import { cache } from 'react';
import { crmEnabled } from '@/lib/crm';

// Marketing/analytics pixel configuration, stored as JSON in a single Setting
// row. IDs are injected site-wide on the marketing pages, but only fire after
// the visitor grants the matching cookie consent (analytics vs marketing).
export type TrackingConfig = {
  ga4Id: string;       // Google Analytics 4 — "G-XXXXXXX"  (analytics consent)
  googleAdsId: string; // Google Ads conversion — "AW-XXXXXXX" (marketing consent)
  metaPixelId: string; // Meta (Facebook/Instagram) Pixel — numeric (marketing consent)
};

export const SETTING_KEY = 'tracking_config';
const EMPTY: TrackingConfig = { ga4Id: '', googleAdsId: '', metaPixelId: '' };

const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 40) : '');

// The Meta Pixel ID is a public, client-side identifier (not a secret — it ships
// in the page source). The owner's ID was never persisted to the tracking_config
// Setting, so the browser pixel + Meta CAPI were dark on every page. Set it as the
// env-fallback default so it goes live immediately; a value saved in Admin → SEO,
// or the NEXT_PUBLIC_META_PIXEL_ID env var, overrides it. Note: because a blank
// field falls back here, fully disabling Meta means clearing this default too.
const DEFAULT_META_PIXEL_ID = '872329642090480';

const ENV_FALLBACK: TrackingConfig = {
  ga4Id: clean(process.env.NEXT_PUBLIC_GA4_ID),
  googleAdsId: clean(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID),
  metaPixelId: clean(process.env.NEXT_PUBLIC_META_PIXEL_ID) || DEFAULT_META_PIXEL_ID,
};

export const getTrackingConfig = cache(async (): Promise<TrackingConfig> => {
  if (!crmEnabled) return ENV_FALLBACK;
  try {
    const { db } = await import('@/lib/db');
    const row = await db.setting.findUnique({ where: { key: SETTING_KEY } });
    if (!row?.value) return ENV_FALLBACK;
    const j = JSON.parse(row.value) as Partial<TrackingConfig>;
    return {
      ga4Id: clean(j.ga4Id) || ENV_FALLBACK.ga4Id,
      googleAdsId: clean(j.googleAdsId) || ENV_FALLBACK.googleAdsId,
      metaPixelId: clean(j.metaPixelId) || ENV_FALLBACK.metaPixelId,
    };
  } catch {
    return ENV_FALLBACK;
  }
});

export const hasAnyTracking = (c: TrackingConfig) => Boolean(c.ga4Id || c.googleAdsId || c.metaPixelId);
