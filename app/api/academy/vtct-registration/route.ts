import { NextResponse } from 'next/server';
import { crmEnabled } from '@/lib/crm';

export const runtime = 'nodejs';

// BLD-1794: trainee submits (or resubmits) their VTCT Registration Details.
//   POST { op:'submit', ...fields, documents, declarationAgreed }
export async function POST(req: Request) {
  if (!crmEnabled) return NextResponse.json({ ok: false }, { status: 503 });
  const { getCurrentStudent } = await import('@/lib/academy-auth');
  const student = await getCurrentStudent().catch(() => null);
  if (!student) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.op !== 'submit') return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });

  const { submitRegistration } = await import('@/lib/vtct-registration');
  const r = await submitRegistration(student.id, {
    title: b.title as string, firstName: b.firstName as string, middleNames: b.middleNames as string, lastName: b.lastName as string,
    dob: b.dob as string, gender: b.gender as string, genderSelfDescribe: b.genderSelfDescribe as string,
    personalEmail: b.personalEmail as string, phone: b.phone as string,
    addressLine1: b.addressLine1 as string, addressLine2: b.addressLine2 as string, addressCity: b.addressCity as string, addressPostcode: b.addressPostcode as string, addressCountry: b.addressCountry as string,
    previouslyRegistered: b.previouslyRegistered, priorLearnerCode: b.priorLearnerCode as string,
    documents: b.documents, declarationAgreed: b.declarationAgreed,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
