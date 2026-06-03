import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from './db';
import { site } from './site';
import { primaryNav, footerNav, type NavGroup } from './nav';

// ─────────────────────────────────────────────────────────────────────────────
// The live, editable global configuration for the marketing site. Defaults come
// from lib/site.ts (+ lib/nav.ts); an admin can override any of it from
// Admin → Site, stored as a single SiteConfig row. Read everywhere via
// getSiteConfig() — cached and tag-revalidated so pages stay fast/static and
// update the instant the config is saved.
// ─────────────────────────────────────────────────────────────────────────────

export type FooterColumn = { heading: string; links: { label: string; href: string }[] };
export type AnnouncementConfig = {
  enabled: boolean;
  message: string;
  linkLabel?: string;
  linkHref?: string;
  startAt?: string | null; // ISO date (inclusive) or null = no start bound
  endAt?: string | null;   // ISO date (inclusive) or null = no end bound
};

export type SiteConfig = {
  name: string;
  legalName: string;
  tagline: string;
  description: string;
  phone: string;
  phoneHref: string;
  whatsapp: string;
  email: string;
  emailHref: string;
  address: { street: string; locality: string; region: string; postalCode: string; country: string; countryName: string };
  geo: { latitude: number; longitude: number };
  mapEmbed: string;
  mapLink: string;
  hours: { day: string; dow: string; open: string; close: string }[];
  booking: { path: string; phoneCta: string };
  social: Record<string, string>;
  dentistryLive: boolean;
  announcement: AnnouncementConfig;
  nav: { primary: NavGroup[]; footer: FooterColumn[] };
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const DEFAULT_CONFIG: SiteConfig = {
  ...(clone(site) as unknown as Omit<SiteConfig, 'social' | 'announcement' | 'nav'>),
  social: clone(site.social) as Record<string, string>,
  announcement: { enabled: false, message: '', linkLabel: '', linkHref: '', startAt: null, endAt: null },
  nav: { primary: clone(primaryNav), footer: clone(footerNav) as FooterColumn[] },
};

/** Deep-merge a stored (possibly partial / older) config over the defaults. */
export function mergeConfig(base: SiteConfig, over: Partial<SiteConfig> | null | undefined): SiteConfig {
  if (!over || typeof over !== 'object') return base;
  return {
    ...base,
    ...over,
    address: { ...base.address, ...(over.address || {}) },
    geo: { ...base.geo, ...(over.geo || {}) },
    booking: { ...base.booking, ...(over.booking || {}) },
    social: { ...base.social, ...(over.social || {}) },
    announcement: { ...base.announcement, ...(over.announcement || {}) },
    hours: Array.isArray(over.hours) && over.hours.length ? over.hours : base.hours,
    nav: {
      primary: Array.isArray(over.nav?.primary) ? over.nav!.primary : base.nav.primary,
      footer: Array.isArray(over.nav?.footer) ? over.nav!.footer : base.nav.footer,
    },
  };
}

export const SITE_CONFIG_TAG = 'site-config';

async function load(): Promise<SiteConfig> {
  try {
    const row = await db.siteConfig.findUnique({ where: { id: 'singleton' }, select: { data: true } });
    return mergeConfig(DEFAULT_CONFIG, (row?.data as Partial<SiteConfig> | undefined) ?? null);
  } catch {
    // Table not migrated yet, or DB unavailable → safe static defaults.
    return DEFAULT_CONFIG;
  }
}

/** Cached config read. Pages stay static; saving the config revalidates the tag. */
export const getSiteConfig = unstable_cache(load, ['site-config-v1'], { tags: [SITE_CONFIG_TAG], revalidate: 3600 });

/** True when the announcement bar should currently show (enabled + in date window). */
export function announcementActive(a: AnnouncementConfig, now = new Date()): boolean {
  if (!a?.enabled || !a.message?.trim()) return false;
  if (a.startAt && now < new Date(a.startAt)) return false;
  if (a.endAt) { const end = new Date(a.endAt); end.setHours(23, 59, 59, 999); if (now > end) return false; }
  return true;
}
