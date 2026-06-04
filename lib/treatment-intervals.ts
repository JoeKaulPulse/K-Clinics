// Recommended spacing between treatment sessions. Many course-based treatments
// (especially laser hair removal) need gradually longer gaps as the course
// progresses. Given how many sessions a client has already completed, this
// returns the recommended weeks until the next session and a target date.

type Family = 'lhr' | 'laser' | 'facial' | 'body' | 'hifu';

// weeks-until-next, indexed by completed-session count (clamped to last).
const SCHEDULES: Record<Family, number[]> = {
  lhr: [4, 4, 5, 6, 6, 8, 8, 10, 12], // laser hair removal — widening intervals
  laser: [6, 6, 7, 8, 8],             // tattoo / pigmentation / vascular / IPL / resurfacing
  facial: [2, 3, 4, 4],               // peels / HydraFacial / CACI courses
  body: [1, 1, 2, 2],                 // BodySphere / body contouring (weekly-ish)
  hifu: [4, 4, 26],                   // HIFU / RF — course then ~6-month maintenance
};

function familyFor(slug: string): Family | null {
  if (/hair-removal/.test(slug)) return 'lhr';
  if (/hifu|rf-lifting/.test(slug)) return 'hifu';
  if (/endosphere|bodysphere|body-contour/.test(slug)) return 'body';
  if (/facial|peel|caci|hydra|cosmetic/.test(slug)) return 'facial';
  if (/laser|tattoo|pigment|vascular|spider|ipl|resurfac|rejuven|fungal/.test(slug)) return 'laser';
  return null;
}

export type NextRecommendation = { weeks: number; date: Date; maintenance: boolean };

/** Recommended next session for a treatment, given completed sessions so far. */
export function recommendedNext(slug: string, completedSessions: number, from: Date = new Date()): NextRecommendation | null {
  const fam = familyFor(slug);
  if (!fam) return null;
  const sched = SCHEDULES[fam];
  const idx = Math.min(Math.max(0, completedSessions), sched.length - 1);
  const weeks = sched[idx];
  const date = new Date(from);
  date.setDate(date.getDate() + weeks * 7);
  return { weeks, date, maintenance: weeks >= 16 };
}

export const formatInterval = (weeks: number) =>
  weeks >= 16 ? `about ${Math.round(weeks / 4.345)} months` : `about ${weeks} week${weeks === 1 ? '' : 's'}`;
