'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession } from '@/lib/auth';

// PRJ-63 — staff clock in/out + break actions. Any signed-in staff member may
// track their own time (no extra permission); the actions only ever act on the
// caller's own userId.

export async function clockInOutAction(action: 'in' | 'out') {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const tt = await import('@/lib/time-tracking');
  const res = action === 'in' ? await tt.clockIn(session.sub) : await tt.clockOut(session.sub);
  revalidatePath('/admin/my-day');
  revalidatePath('/admin');
  return res;
}

export async function breakAction(action: 'start' | 'end', note?: string) {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not signed in.' };
  const tt = await import('@/lib/time-tracking');
  const res = action === 'start' ? await tt.startBreak(session.sub, note) : await tt.endBreak(session.sub);
  revalidatePath('/admin/my-day');
  revalidatePath('/admin');
  return res;
}
