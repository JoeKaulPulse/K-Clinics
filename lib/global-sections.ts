import 'server-only';
import { db } from './db';
import type { Section } from './sections';

// Reusable sections referenced from pages via { type: 'ref', data: { refId } }.
export const GLOBALS_TAG = 'cms-globals';

export async function listGlobalSections() {
  try { return await db.globalSection.findMany({ orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, type: true, updatedAt: true } }); }
  catch { return []; }
}

export async function getGlobalSection(id: string) {
  try { return await db.globalSection.findUnique({ where: { id } }); }
  catch { return null; }
}

/** Replace any { type:'ref' } sections with the live content of their global. */
export async function resolveSections(sections: Section[]): Promise<Section[]> {
  const refIds = sections.filter((s) => s.type === 'ref').map((s) => String((s.data as { refId?: string }).refId || '')).filter(Boolean);
  if (!refIds.length) return sections;
  const globals: Record<string, { type: string; data: Record<string, unknown> }> = {};
  try {
    const rows = await db.globalSection.findMany({ where: { id: { in: refIds } }, select: { id: true, type: true, data: true } });
    for (const r of rows) globals[r.id] = { type: r.type, data: (r.data as Record<string, unknown>) || {} };
  } catch { /* ignore */ }
  return sections.flatMap((s) => {
    if (s.type !== 'ref') return [s];
    const g = globals[String((s.data as { refId?: string }).refId || '')];
    return g ? [{ id: s.id, type: g.type, data: g.data, hidden: s.hidden } as Section] : [];
  });
}
