import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-534: learner portfolio (student actions).
//   POST { op:'create', ...fields }            → new draft
//   POST { op:'update', id, ...fields }         → edit owned entry
//   POST { op:'submit', id }                    → submit for review
//   POST { op:'delete', id }                    → delete owned entry
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const p = await import('@/lib/portfolio');
  const input = { title: b.title, treatmentType: b.treatmentType, treatmentDate: b.treatmentDate, clientRef: b.clientRef, notes: b.notes, courseId: b.courseId, photos: b.photos } as Parameters<typeof p.createEntry>[1];

  switch (b.op) {
    case 'create': { const r = await p.createEntry(student.id, input); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
    case 'update': { if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 }); const r = await p.updateEntry(student.id, String(b.id), input); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
    case 'submit': { if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 }); const r = await p.submitEntry(student.id, String(b.id)); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
    case 'delete': { if (!b.id) return NextResponse.json({ ok: false, error: 'Missing id.' }, { status: 400 }); const r = await p.deleteEntry(student.id, String(b.id)); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
  }
  return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
