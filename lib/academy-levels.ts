// Academy level curve — pure (usable on client and server). XP maps to a level
// with a title and progress toward the next. Kept separate from the server-only
// gamification engine so the player HUD can compute it live as XP ticks up.

export const ACADEMY_LEVELS: { at: number; title: string }[] = [
  { at: 0, title: 'Newcomer' },
  { at: 100, title: 'Apprentice' },
  { at: 300, title: 'Trainee' },
  { at: 650, title: 'Practitioner' },
  { at: 1100, title: 'Senior' },
  { at: 1700, title: 'Specialist' },
  { at: 2600, title: 'Expert' },
  { at: 4000, title: 'Master' },
];

export type AcademyLevel = { level: number; title: string; xp: number; into: number; span: number; nextAt: number | null; pct: number };

export function academyLevel(xp: number): AcademyLevel {
  const x = Math.max(0, Math.floor(xp) || 0);
  let i = 0;
  for (let k = 0; k < ACADEMY_LEVELS.length; k++) if (x >= ACADEMY_LEVELS[k].at) i = k;
  const cur = ACADEMY_LEVELS[i];
  const next = ACADEMY_LEVELS[i + 1] ?? null;
  const into = x - cur.at;
  const span = next ? next.at - cur.at : 0;
  return { level: i + 1, title: cur.title, xp: x, into, span, nextAt: next?.at ?? null, pct: span ? Math.min(100, Math.round((into / span) * 100)) : 100 };
}
