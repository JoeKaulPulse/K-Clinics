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

export const getTrackingConfig = cache(async (): Promise<TrackingConfig> => {
  if (!crmEnabled) return EMPTY;
  try {
    const { db } = await import('@/lib/db');
    const row = await db.setting.findUnique({ where: { key: SETTING_KEY } });
    if (!row?.value) return EMPTY;
    const j = JSON.parse(row.value) as Partial<TrackingConfig>;
    return { ga4Id: clean(j.ga4Id), googleAdsId: clean(j.googleAdsId), metaPixelId: clean(j.metaPixelId) };
  } catch {
    return EMPTY;
  }
});

export const hasAnyTracking = (c: TrackingConfig) => Boolean(c.ga4Id || c.googleAdsId || c.metaPixelId);
