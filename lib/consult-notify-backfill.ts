import 'server-only';

// BLD-1345 — retroactive delivery for consultation enquiries that never reached
// a person.
//
// Until this fix, a new consultation request notified staff through exactly one
// channel a human sees: a single email to the shared CLINIC_NOTIFY_EMAIL inbox.
// The per-user email copy never fired (the `messages` category ships with email
// off), web-push is inert without VAPID keys, and the in-app StaffNotification row
// only started being written on 2026-08-05 — so enquiries before that produced no
// per-person notification at all, and the ones after it were visible only while
// signed into the admin with the bell open.
//
// This sends the missed work to the staff who handle enquiries as ONE summary
// (an email plus a single in-app row), not one notification per enquiry — a
// hundred back-dated rows would bury the bell and tell nobody anything. The
// summary stays non-clinical: name, date, category and treatments only. The
// encrypted `concerns`/`message` never leave the consultation page.
//
// Run-once by design: the daily cron calls the `IfNeeded` wrapper, which flags
// itself done via a Setting row so staff are not re-notified every night. The
// owner-gated maintenance route can force a re-run.

import { db } from '@/lib/db';

const DONE_KEY = 'consult_notify_backfill_v1';

/** How far back to look for enquiries nobody was told about. */
const WINDOW_DAYS = 90;
/** Cap the summary so one email can't become unreadable. */
const MAX_LISTED = 100;

/** The staff the owner named for the retro push. Matched at runtime against the
 *  AdminUser name/email rather than hard-coded addresses, so it survives a
 *  mailbox rename. `CONSULT_BACKFILL_EMAILS` (comma-separated) overrides it
 *  outright when the match needs to be exact. Transliteration variants included
 *  because both spellings are in common use. */
const RETRO_FIRST_NAMES = ['inna', 'tetiana', 'tetyana', 'tatiana'];

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || 'https://kclinics.co.uk';
  return raw.replace(/\/$/, '');
})();

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

type Staff = { id: string; email: string; name: string | null };

/** Addresses named explicitly in the environment, if any. */
function overrideEmails(): string[] {
  return (process.env.CONSULT_BACKFILL_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Does this staff row look like one of the people the owner named? Matches the
 *  first name token, or a segment of the mailbox local part, so "Tetiana K",
 *  "tetiana@…" and "tetiana.k@…" all resolve. Never a bare substring match —
 *  that would catch unrelated names that merely contain the string. */
function isRetroRecipient(u: Staff): boolean {
  const first = (u.name || '').trim().toLowerCase().split(/\s+/)[0] || '';
  const local = u.email.toLowerCase().split('@')[0];
  const parts = local.split(/[._\-+]/).filter(Boolean);
  return RETRO_FIRST_NAMES.some((n) => first === n || parts.includes(n));
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(d);

export type BackfillResult = {
  ran: boolean;
  /** Enquiries found in the window. */
  consultations: number;
  /** Staff who received the summary. */
  recipients: string[];
  emailed: number;
  notified: number;
  /** Set when the window had work but nobody matched — the owner needs to know. */
  warning?: string;
};

/** Send the retro summary. Idempotency is the caller's job (see the `IfNeeded`
 *  wrapper); this always does the work it is asked to do. */
export async function runConsultNotificationBackfill(opts: { emails?: string[] } = {}): Promise<BackfillResult> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const consultations = await db.consultation.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: MAX_LISTED,
    select: {
      id: true, category: true, treatments: true, status: true, createdAt: true,
      client: { select: { firstName: true, lastName: true } },
    },
  });

  const total = await db.consultation.count({ where: { createdAt: { gte: since } } });
  if (!consultations.length) return { ran: true, consultations: 0, recipients: [], emailed: 0, notified: 0 };

  // Resolve who gets the summary: an explicit list wins, then the environment
  // override, then the staff the owner named.
  const staff = await db.adminUser.findMany({ where: { active: true }, select: { id: true, email: true, name: true } });
  const explicit = (opts.emails?.length ? opts.emails : overrideEmails()).map((e) => e.toLowerCase());
  const recipients = explicit.length
    ? staff.filter((u) => explicit.includes(u.email.toLowerCase()))
    : staff.filter(isRetroRecipient);

  if (!recipients.length) {
    // Deliberately do NOT fall back to emailing the whole team — an unexpected
    // blast to every staff account is worse than a reported miss.
    const warning = `No staff matched the retro recipients (${explicit.length ? explicit.join(', ') : RETRO_FIRST_NAMES.join('/')}). Set CONSULT_BACKFILL_EMAILS to their exact addresses and re-run.`;
    console.error('[consult-backfill]', warning);
    return { ran: true, consultations: total, recipients: [], emailed: 0, notified: 0, warning };
  }

  const rows = consultations.map((c) => {
    const who = [c.client?.firstName, c.client?.lastName].filter(Boolean).join(' ') || 'Name not given';
    const treatments = c.treatments?.length ? c.treatments.slice(0, 4).join(', ') : '—';
    return { id: c.id, who, treatments, category: c.category, status: c.status, createdAt: c.createdAt };
  });
  const stillNew = rows.filter((r) => r.status === 'NEW').length;

  const list = rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap;color:#6b6259;font-size:13px;">${escapeHtml(fmtDate(r.createdAt))}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;"><a href="${SITE_URL}/admin/consultations/${encodeURIComponent(r.id)}" style="color:#2a2420;">${escapeHtml(r.who)}</a></td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#6b6259;">${escapeHtml(r.category)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#6b6259;">${escapeHtml(r.treatments)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:${r.status === 'NEW' ? '#a8321e' : '#6b6259'};">${escapeHtml(r.status)}</td>
        </tr>`,
    )
    .join('');

  const more = total > rows.length ? `<p style="color:#6b6259;font-size:13px;">Showing the ${rows.length} most recent of ${total} in this period.</p>` : '';
  const body =
    `<h1 style="font-size:22px;margin:0 0 12px;color:#2a2420;">Consultation enquiries you were not notified about</h1>` +
    `<p style="margin:0 0 8px;">A fault meant new consultation requests were not being sent to you — they only ever reached the shared inbox. That is now fixed, and from here you will be emailed as each one arrives.</p>` +
    `<p style="margin:0 0 16px;">Here is everything from the last ${WINDOW_DAYS} days so nothing is missed: <strong>${total} enquir${total === 1 ? 'y' : 'ies'}</strong>, of which <strong>${stillNew}</strong> ${stillNew === 1 ? 'is' : 'are'} still marked New.</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">` +
    `<tr><th align="left" style="padding:8px 10px;border-bottom:2px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b6259;">When</th>` +
    `<th align="left" style="padding:8px 10px;border-bottom:2px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b6259;">Who</th>` +
    `<th align="left" style="padding:8px 10px;border-bottom:2px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b6259;">Interest</th>` +
    `<th align="left" style="padding:8px 10px;border-bottom:2px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b6259;">Treatments</th>` +
    `<th align="left" style="padding:8px 10px;border-bottom:2px solid #ddd;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b6259;">Status</th></tr>` +
    list +
    `</table>` +
    more +
    `<p style="margin:16px 0;"><a href="${SITE_URL}/admin/consultations" style="color:#2a2420;">Open the consultations list →</a></p>`;

  const { sendEmail, tmplManual } = await import('@/lib/email');
  const subject = `${total} consultation enquir${total === 1 ? 'y' : 'ies'} you were not notified about`;

  let emailed = 0;
  let notified = 0;
  for (const u of recipients) {
    const res = await sendEmail({ to: u.email, subject, html: tmplManual(body) });
    if (res.ok) emailed++;
    await db.emailEvent
      .create({ data: { kind: 'CONSULT_NOTIFY', to: u.email, subject, status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } })
      .catch(() => {});

    // One in-app row alongside it, pointing at the list rather than any single
    // enquiry. Written directly (not via notifyStaff*) so it lands regardless of
    // the category preferences that suppressed these notifications in the first place.
    const created = await db.staffNotification
      .create({
        data: {
          userId: u.id,
          kind: 'status',
          category: 'messages',
          priority: 'high',
          title: `${total} consultation enquir${total === 1 ? 'y' : 'ies'} you were not notified about`,
          body: `${stillNew} still marked New. Notifications for new enquiries are now fixed.`,
          href: '/admin/consultations',
          groupKey: 'consult-notify-backfill',
        },
      })
      .catch(() => null);
    if (created) notified++;
  }

  return { ran: true, consultations: total, recipients: recipients.map((u) => u.email), emailed, notified };
}

/** Self-healing entry point for the daily cron: runs the retro push once, then
 *  flags itself done so staff are not re-notified on every subsequent run. */
export async function backfillConsultNotificationsIfNeeded(): Promise<BackfillResult> {
  const done = await db.setting.findUnique({ where: { key: DONE_KEY } }).catch(() => null);
  if (done?.value === 'true') return { ran: false, consultations: 0, recipients: [], emailed: 0, notified: 0 };

  const result = await runConsultNotificationBackfill();
  // Only latch when the push actually landed. A run that matched nobody (or had
  // nothing to send) stays pending so it retries once the owner sets
  // CONSULT_BACKFILL_EMAILS — otherwise a misconfigured first run silently
  // consumes the one-shot.
  if (result.emailed > 0) {
    await db.setting
      .upsert({ where: { key: DONE_KEY }, update: { value: 'true' }, create: { key: DONE_KEY, value: 'true' } })
      .catch(() => {});
  }
  return result;
}
