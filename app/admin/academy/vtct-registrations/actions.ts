'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession } from '@/lib/auth';

// BLD-1867 — "Make VTCT Registration Declaration Editable". The Student
// Declaration shown on the public VTCT Registration page (title, body,
// checkbox wording) used to be hardcoded in lib/vtct-registration.ts. This
// action lets the account OWNER edit it, backed by the three Setting rows
// read at app/(marketing)/academy/vtct-registration/page.tsx. Restricted to
// OWNER, not the wider ADMIN_ROLES set (see sessionIsAdmin in lib/auth.ts) —
// mirroring saveAgreementDraft/publishAgreement in
// app/admin/academy/agreement/actions.ts, this check is the real guard, not
// the page hiding the editor from non-owners.

const MAX_TITLE = 200;
const MAX_CHECKBOX_LABEL = 300;
const MAX_BODY = 8000;

function clean(value: unknown, max: number): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return null;
  return s.slice(0, max);
}

export async function saveVtctDeclaration(input: { title: string; body: string; checkboxLabel: string }): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'CRM disabled' };
  const session = await getSession();
  if (!session || session.role !== 'OWNER') return { ok: false, error: 'Only the account owner can edit the Student Declaration.' };

  const title = clean(input.title, MAX_TITLE);
  if (!title) return { ok: false, error: 'Please enter a title.' };
  const body = clean(input.body, MAX_BODY);
  if (!body) return { ok: false, error: 'Please enter the declaration text.' };
  const checkboxLabel = clean(input.checkboxLabel, MAX_CHECKBOX_LABEL);
  if (!checkboxLabel) return { ok: false, error: 'Please enter the checkbox wording.' };

  const {
    DECLARATION_TITLE_KEY, DECLARATION_BODY_KEY, DECLARATION_CHECKBOX_KEY,
    DECLARATION_TITLE, DECLARATION_TEXT, DECLARATION_CHECKBOX_LABEL,
  } = await import('@/lib/vtct-registration');
  const { getStringSetting, setStringSetting } = await import('@/lib/settings');

  // Review fix (BLD-1867): read the outgoing wording BEFORE overwriting it.
  // A learner's registration stores only declarationAgreedAt, not the text
  // they agreed to — while the wording was a source constant, git history was
  // the record of what was in force on a given date. Now that it is editable
  // at runtime, the audit event is that record, so it carries the full
  // before/after rather than just "updated".
  const [prevTitle, prevBody, prevCheckboxLabel] = await Promise.all([
    getStringSetting(DECLARATION_TITLE_KEY, DECLARATION_TITLE),
    getStringSetting(DECLARATION_BODY_KEY, DECLARATION_TEXT),
    getStringSetting(DECLARATION_CHECKBOX_KEY, DECLARATION_CHECKBOX_LABEL),
  ]);

  await Promise.all([
    setStringSetting(DECLARATION_TITLE_KEY, title, session.email),
    setStringSetting(DECLARATION_BODY_KEY, body, session.email),
    setStringSetting(DECLARATION_CHECKBOX_KEY, checkboxLabel, session.email),
  ]);

  const { logAudit } = await import('@/lib/audit');
  await logAudit({
    action: 'SETTINGS_UPDATED',
    actor: session.email,
    actorRole: session.role,
    summary: 'VTCT Registration Student Declaration updated (BLD-1867)',
    meta: {
      previous: { title: prevTitle, body: prevBody, checkboxLabel: prevCheckboxLabel },
      next: { title, body, checkboxLabel },
    },
  }).catch(() => {});

  revalidatePath('/academy/vtct-registration');
  revalidatePath('/admin/academy/vtct-registrations');
  return { ok: true };
}
