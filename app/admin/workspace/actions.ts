'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import * as ws from '@/lib/google-workspace';

// Google Workspace provisioning actions (BLD-312 Phase B). Every write is gated on
// settings.manage (owner/admin) and recorded in the audit log. Temporary passwords
// are returned to the caller to hand over but never logged.

async function guard() {
  if (!crmEnabled) return { session: null, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) return { session: null, error: 'Not permitted' };
  return { session, error: null as string | null };
}

async function audit(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, summary: string, meta: Record<string, unknown>) {
  await logAudit({ action: 'SETTINGS_UPDATED', actor: session.email, actorRole: session.role, summary, meta: { area: 'google-workspace', ...meta } });
}

export async function createUserAction(input: { email: string; firstName: string; lastName: string }): Promise<{ ok: boolean; error?: string; tempPassword?: string }> {
  const g = await guard();
  if (!g.session) return { ok: false, error: g.error ?? 'Not permitted' };
  const r = await ws.createWorkspaceUser(input);
  if (r.ok) {
    await audit(g.session, `Workspace: created mailbox ${input.email}`, { op: 'createUser', email: input.email });
    revalidatePath('/admin/workspace');
  }
  return r;
}

export async function setSuspendedAction(email: string, suspended: boolean) {
  const g = await guard();
  if (!g.session) return { ok: false, error: g.error ?? 'Not permitted' };
  const r = await ws.setWorkspaceUserSuspended(email, suspended);
  if (r.ok) {
    await audit(g.session, `Workspace: ${suspended ? 'suspended' : 'restored'} ${email}`, { op: suspended ? 'suspend' : 'restore', email });
    revalidatePath('/admin/workspace');
  }
  return r;
}

export async function addAliasAction(email: string, alias: string) {
  const g = await guard();
  if (!g.session) return { ok: false, error: g.error ?? 'Not permitted' };
  const r = await ws.addUserAlias(email, alias);
  if (r.ok) {
    await audit(g.session, `Workspace: added alias ${alias} → ${email}`, { op: 'addAlias', email, alias });
    revalidatePath('/admin/workspace');
  }
  return r;
}

export async function removeAliasAction(email: string, alias: string) {
  const g = await guard();
  if (!g.session) return { ok: false, error: g.error ?? 'Not permitted' };
  const r = await ws.removeUserAlias(email, alias);
  if (r.ok) {
    await audit(g.session, `Workspace: removed alias ${alias} from ${email}`, { op: 'removeAlias', email, alias });
    revalidatePath('/admin/workspace');
  }
  return r;
}

export async function createGroupAction(input: { email: string; name: string; description?: string }) {
  const g = await guard();
  if (!g.session) return { ok: false, error: g.error ?? 'Not permitted' };
  const r = await ws.createWorkspaceGroup(input);
  if (r.ok) {
    await audit(g.session, `Workspace: created group ${input.email}`, { op: 'createGroup', email: input.email });
    revalidatePath('/admin/workspace');
  }
  return r;
}

export async function addMemberAction(groupEmail: string, memberEmail: string) {
  const g = await guard();
  if (!g.session) return { ok: false, error: g.error ?? 'Not permitted' };
  const r = await ws.addGroupMember(groupEmail, memberEmail);
  if (r.ok) {
    await audit(g.session, `Workspace: added ${memberEmail} to ${groupEmail}`, { op: 'addMember', group: groupEmail, member: memberEmail });
    revalidatePath('/admin/workspace');
  }
  return r;
}

export async function removeMemberAction(groupEmail: string, memberEmail: string) {
  const g = await guard();
  if (!g.session) return { ok: false, error: g.error ?? 'Not permitted' };
  const r = await ws.removeGroupMember(groupEmail, memberEmail);
  if (r.ok) {
    await audit(g.session, `Workspace: removed ${memberEmail} from ${groupEmail}`, { op: 'removeMember', group: groupEmail, member: memberEmail });
    revalidatePath('/admin/workspace');
  }
  return r;
}
