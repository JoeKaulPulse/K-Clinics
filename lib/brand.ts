import 'server-only';
import { cache } from 'react';
import { crmEnabled } from '@/lib/crm';
import { defaultTheme } from '@/lib/theme';
import { site } from '@/lib/site';

// ── Brand asset hub ──────────────────────────────────────────────────────────
// One editable "brand kit" — colours, fonts, logos, tagline and tone of voice —
// that everything marketing leans on: email templates, generated landing pages,
// and the AI assistant's prompts (so AI-written copy is always on-brand).
// Stored as JSON in a single Setting row; sensible defaults from the live theme.

export type BrandColor = { name: string; hex: string; role: string };
export type BrandVoice = { tone: string; descriptors: string[]; doList: string[]; dontList: string[] };
export type BrandKit = {
  tagline: string;
  about: string; // short brand description — also feeds AI context
  palette: BrandColor[];
  fonts: { display: string; body: string; notes: string };
  logos: { primary: string; mark: string; light: string; favicon: string };
  voice: BrandVoice;
  social: { instagram: string; facebook: string; tiktok: string };
};

export const BRAND_SETTING_KEY = 'brand_kit';

function defaults(): BrandKit {
  return {
    tagline: site.tagline ?? 'Refined aesthetic & dental care',
    about: site.description ?? 'A premium aesthetics and dental clinic offering results-led treatments with a warm, expert touch.',
    palette: [
      { name: 'Ink', hex: defaultTheme.ink, role: 'Primary text & dark sections' },
      { name: 'Porcelain', hex: defaultTheme.porcelain, role: 'Primary light background' },
      { name: 'Bone', hex: defaultTheme.bone, role: 'Secondary light surface' },
      { name: 'Gold', hex: defaultTheme.gold, role: 'Primary accent (buttons, highlights)' },
      { name: 'Gold Soft', hex: defaultTheme.goldSoft, role: 'Light accent' },
      { name: 'Stone', hex: defaultTheme.stone, role: 'Muted taupe text' },
      { name: 'Jade', hex: defaultTheme.jade, role: 'Secondary accent' },
      { name: 'Blush', hex: defaultTheme.blush, role: 'Soft highlight' },
    ],
    fonts: { display: 'Fraunces', body: 'Geist Sans', notes: 'Editorial serif for headings; clean humanist sans for body copy.' },
    logos: { primary: '', mark: '', light: '', favicon: '' },
    voice: {
      tone: 'Warm, premium and clinically credible — quietly confident, never pushy or salesy. British English.',
      descriptors: ['Refined', 'Warm', 'Expert', 'Reassuring', 'Understated luxury'],
      doList: ['Lead with outcomes and genuine care', 'Speak with quiet confidence', 'Be specific and transparent about results & pricing'],
      dontList: ['No hype, hard-sell or clickbait', 'No medical guarantees or pressure tactics', 'Avoid unexplained jargon'],
    },
    social: { instagram: site.social?.instagram ?? '', facebook: site.social?.facebook ?? '', tiktok: site.social?.tiktok ?? '' },
  };
}

// Deep-merge stored values over defaults so new default fields always appear.
function merge(base: BrandKit, over: Partial<BrandKit> | null): BrandKit {
  if (!over) return base;
  return {
    tagline: over.tagline ?? base.tagline,
    about: over.about ?? base.about,
    palette: Array.isArray(over.palette) && over.palette.length ? over.palette : base.palette,
    fonts: { ...base.fonts, ...(over.fonts ?? {}) },
    logos: { ...base.logos, ...(over.logos ?? {}) },
    voice: { ...base.voice, ...(over.voice ?? {}) },
    social: { ...base.social, ...(over.social ?? {}) },
  };
}

export const getBrandKit = cache(async (): Promise<BrandKit> => {
  const base = defaults();
  if (!crmEnabled) return base;
  try {
    const { db } = await import('@/lib/db');
    const row = await db.setting.findUnique({ where: { key: BRAND_SETTING_KEY } });
    if (!row?.value) return base;
    return merge(base, JSON.parse(row.value) as Partial<BrandKit>);
  } catch {
    return base;
  }
});

/** Compact brand context string for AI prompts so generated copy stays on-brand. */
export function brandContextForAI(b: BrandKit): string {
  return [
    `Brand: ${site.name}. ${b.tagline}.`,
    `About: ${b.about}`,
    `Tone of voice: ${b.voice.tone}`,
    `Brand descriptors: ${b.voice.descriptors.join(', ')}.`,
    `Always: ${b.voice.doList.join('; ')}.`,
    `Never: ${b.voice.dontList.join('; ')}.`,
    `Primary colours: ${b.palette.slice(0, 4).map((c) => `${c.name} ${c.hex}`).join(', ')}.`,
  ].join('\n');
}
