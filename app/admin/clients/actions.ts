'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';

// BLD-199 — staff edit a client's details; every change writes an immutable
// CLIENT_EDITED audit event (admin-only display). Audit logs are never amended.

const GENDERS = ['FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'];

export type EditClientInput = {
  firstName?: string; lastName?: string; email?: string; phone?: string;
  dob?: string; gender?: string; genderSelfDescribe?: string;
  allergies?: string; notes?: string; marketingOptIn?: boolean;
};

export async function editClient(clientId: string, input: EditClientInput) {
  if (!crmEnabled) return { ok: false as const, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'clients.edit')) return { ok: false as const, error: 'You don’t have permission to edit clients.' };

  const { db } = await import('@/lib/db');
  const current = await db.client.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true, email: true, phone: true, dob: true, gender: true, genderSelfDescribe: true, allergies: true, notes: true, marketingOptIn: true },
  });
  if (!current) return { ok: false as const, error: 'Client not found.' };

  const data: Record<string, unknown> = {};
  const changes: { field: string; from: string; to: string }[] = [];
  const trimOrNull = (v: unknown) => { const s = String(v ?? '').trim(); return s === '' ? null : s; };

  // Optional free-text fields (nullable, non-clinical).
  for (const f of ['lastName', 'phone', 'genderSelfDescribe', 'notes'] as const) {
    if (input[f] === undefined) continue;
    const to = trimOrNull(input[f]);
    const from = (current[f] as string | null) ?? null;
    if (to !== from) { data[f] = to; changes.push({ field: f, from: from ?? '—', to: to ?? '—' }); }
  }

  // Allergies are clinical — encrypted at rest, and redacted in the audit meta
  // (we record THAT it changed, never the content).
  if (input.allergies !== undefined) {
    const { encClinical, decClinical } = await import('@/lib/clinical-crypto');
    const to = trimOrNull(input.allergies);
    const fromPlain = decClinical(current.allergies as string | null) ?? null;
    if (to !== fromPlain) { data.allergies = encClinical(to); changes.push({ field: 'allergies', from: fromPlain ? '•••' : '—', to: to ? '•••' : '—' }); }
  }

  // First name is required — only change when a non-empty value is given.
  if (input.firstName !== undefined) {
    const to = String(input.firstName).trim();
    if (to && to !== current.firstName) { data.firstName = to; changes.push({ field: 'firstName', from: current.firstName, to }); }
  }

  // Email is unique + validated.
  if (input.email !== undefined) {
    const to = String(input.email).trim().toLowerCase();
    if (to && to !== current.email) {
      if (!/^\S+@\S+\.\S+$/.test(to)) return { ok: false as const, error: 'Enter a valid email address.' };
      data.email = to; changes.push({ field: 'email', from: current.email, to });
    }
  }

  // DOB (date only).
  if (input.dob !== undefined) {
    const raw = String(input.dob).trim();
    const toDate = raw ? new Date(raw) : null;
    const fromIso = current.dob ? current.dob.toISOString().slice(0, 10) : null;
    const toIso = toDate && !isNaN(+toDate) ? toDate.toISOString().slice(0, 10) : null;
    if (toIso !== fromIso) { data.dob = toIso ? new Date(toIso) : null; changes.push({ field: 'dob', from: fromIso ?? '—', to: toIso ?? '—' }); }
  }

  // Gender (enum).
  if (input.gender !== undefined) {
    const g = String(input.gender);
    const to = GENDERS.includes(g) ? g : null;
    if (to !== (current.gender ?? null)) { data.gender = to; changes.push({ field: 'gender', from: current.gender ?? '—', to: to ?? '—' }); }
  }

  // Marketing opt-in (boolean).
  if (input.marketingOptIn !== undefined) {
    const to = !!input.marketingOptIn;
    if (to !== current.marketingOptIn) { data.marketingOptIn = to; changes.push({ field: 'marketingOptIn', from: String(current.marketingOptIn), to: String(to) }); }
  }

  if (changes.length === 0) return { ok: true as const, changed: 0 };

  try {
    await db.client.update({ where: { id: clientId }, data });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return { ok: false as const, error: 'That email is already used by another client.' };
    return { ok: false as const, error: 'Could not save the changes.' };
  }

  // Immutable audit entry (admin-only display); never updated or deleted.
  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'CLIENT_EDITED',
    actor: session.email,
    actorRole: session.role,
    clientId,
    summary: `Edited client details: ${changes.map((c) => c.field).join(', ')}`,
    meta: { changes },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  return { ok: true as const, changed: changes.length };
}
