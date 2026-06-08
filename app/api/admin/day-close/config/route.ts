import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';
import type { DayCloseConfig, ChecklistSection } from '@/lib/day-close';

export const runtime = 'nodejs';

// Edit the closedown task template + reminder schedule. Admin/owner only.
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false, error: 'Not enabled.' }, { status: 503 });
  const { requirePermission } = await import('@/lib/auth');
  const session = await requirePermission('dayclose.manage');
  if (!session) return NextResponse.json({ ok: false, error: 'Not permitted.' }, { status: 403 });

  const dc = await import('@/lib/day-close');
  const body = (await req.json().catch(() => ({}))) as Partial<DayCloseConfig>;

  // Validate / normalise — never trust the client shape.
  const time = typeof body.closingTime === 'string' && /^\d{1,2}:\d{2}$/.test(body.closingTime) ? body.closingTime : '18:00';
  const reminders = Array.isArray(body.reminderOffsetsMin)
    ? body.reminderOffsetsMin.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= -240 && n <= 480).slice(0, 6)
    : [];
  const sections: ChecklistSection[] = Array.isArray(body.sections)
    ? body.sections
        .filter((s) => s && typeof s.title === 'string' && s.title.trim())
        .map((s, si) => ({
          id: (s.id || `section-${si}`).toString().slice(0, 60),
          title: s.title.trim().slice(0, 120),
          description: (s.description || '').toString().trim().slice(0, 240) || undefined,
          items: (Array.isArray(s.items) ? s.items : [])
            .filter((it) => it && typeof it.label === 'string' && it.label.trim())
            .map((it, ii) => ({
              id: (it.id || `item-${si}-${ii}`).toString().slice(0, 60),
              label: it.label.trim().slice(0, 200),
              note: !!it.note,
            }))
            .slice(0, 40),
        }))
        .filter((s) => s.items.length > 0)
        .slice(0, 20)
    : [];

  if (!sections.length) return NextResponse.json({ ok: false, error: 'Add at least one section with one task.' }, { status: 400 });

  const config: DayCloseConfig = {
    closingTime: time,
    reminderOffsetsMin: reminders.length ? reminders : [30, 0],
    cashHandling: body.cashHandling ?? true,
    stockTake: body.stockTake ?? true,
    sections,
  };

  await dc.saveDayCloseConfig(config, session.email);
  return NextResponse.json({ ok: true, config });
}
