import 'server-only';
import { Resend } from 'resend';
import { site } from './site';
import { getSecret } from './secrets';
import { K_MARK_LIGHT_B64, K_BADGE_B64, K_WORDMARK_LIGHT_B64 } from './brand-email-assets';
import { EMAIL_HEROES } from './email-heroes';
import { giftCardTheme } from './gift-card-themes';

// Resend sends from the verified `mail.<domain>` subdomain; replies (and reply
// tracking) route to `reply.mail.<domain>` via Resend Inbound. Credentials and
// addresses resolve from owner-managed values first, then hosting env, then a
// sensible default — so a key entered in /admin/settings/credentials works
// without a redeploy.
const MAIL_HOST = (() => { try { return new URL(site.url).hostname.replace(/^www\./, ''); } catch { return 'kclinics.co.uk'; } })();

export type SendResult = { ok: boolean; id?: string; error?: string };

// Resend allows 5 requests/second. A burst (e.g. the nightly cron fanning out
// reminders + digests via Promise.all) trips that 429 limit, which is why
// confirmations/receipts/reminders were "failing" even though the key is valid.
// An in-process gate spaces every send (~4.5/sec, safely under the cap); if one
// still slips through under concurrent load, we back off and retry.
const SEND_GAP_MS = 220;
let lastSendAt = 0;
async function rateGate(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, lastSendAt + SEND_GAP_MS);
  lastSendAt = at;
  const wait = at - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
const isRateLimited = (m: string): boolean => /too many requests|rate.?limit|\b429\b/i.test(m);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The email pipeline: every send acquires a slot before going out, so we stay at or
// below Resend's 5/sec at ALL times. (1) the in-process gate paces sends within an
// instance; (2) a shared limiter (Upstash when configured, Postgres fallback) caps the
// total across every serverless instance — a send WAITS for a free slot rather than
// failing. The 429 retry below is the final backstop.
async function acquireSendSlot(): Promise<void> {
  await rateGate(); // smooth within this instance
  try {
    const { rateLimit } = await import('@/lib/security/rate-limit');
    const deadline = Date.now() + 30_000;
    // ≤4 per rolling second globally (headroom under the cap). Poll for a slot, don't fail.
    while (Date.now() < deadline) {
      if ((await rateLimit('resend-send', 4, 1)).allowed) return;
      await sleep(250);
    }
  } catch { /* limiter unavailable — the in-process gate + retry still protect us */ }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Override the From *display name* only (address stays our verified sender). */
  fromName?: string;
  /** Full From override ("Name <addr@domain>") — e.g. chat from mail.kclinics.co.uk. */
  from?: string;
  /** Extra MIME headers, e.g. List-Unsubscribe for bulk marketing. */
  headers?: Record<string, string>;
  /** Extra file attachments (e.g. an .ics calendar invite). */
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[];
}): Promise<SendResult> {
  const apiKey = await getSecret('RESEND_API_KEY');
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' };
  const resend = new Resend(apiKey);
  const FROM = (await getSecret('EMAIL_FROM')) || `KClinics <hello@mail.${MAIL_HOST}>`;
  const REPLY_TO = (await getSecret('EMAIL_REPLY_TO')) || `KClinics <replies@reply.mail.${MAIL_HOST}>`;
  const FROM_ADDRESS = (FROM.match(/<([^>]+)>/)?.[1] || FROM).trim();
  const from = opts.from?.trim() ? opts.from.trim() : opts.fromName?.trim() ? `${opts.fromName.trim()} <${FROM_ADDRESS}>` : FROM;
  const attachments = [...(brandAttachments(opts.html).attachments || []), ...(opts.attachments || [])];
  const payload = {
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo || REPLY_TO,
    ...(attachments.length ? { attachments } : {}),
    ...(opts.headers ? { headers: opts.headers } : {}),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    await acquireSendSlot();
    try {
      // BLD-281: cap the Resend call so a hanging API can't pin the serverless
      // function to its maxDuration — booking/notify flows degrade fast instead.
      const TIMEOUT = Symbol('timeout');
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        resend.emails.send(payload),
        new Promise<typeof TIMEOUT>((resolve) => { timer = setTimeout(() => resolve(TIMEOUT), 10_000); }),
      ]).finally(() => { if (timer) clearTimeout(timer); });
      if (result === TIMEOUT) return { ok: false, error: 'Email send timed out after 10s' };
      const { data, error } = result;
      if (error) {
        const msg = String(error.message || error);
        if (isRateLimited(msg) && attempt < 2) { await sleep(1100 * (attempt + 1)); continue; }
        return { ok: false, error: msg };
      }
      return { ok: true, id: data?.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'send failed';
      if (isRateLimited(msg) && attempt < 2) { await sleep(1100 * (attempt + 1)); continue; }
      return { ok: false, error: msg };
    }
  }
  return { ok: false, error: 'Email rate-limited — retried and gave up' };
}

// The brand marks ride along as inline (cid:) attachments — embedded from
// bundled base64 — so the logo always renders regardless of whether an external
// URL is reachable from the recipient's mail client. Only attached when the HTML
// actually references the cid, so unrelated mail stays lean.
function brandAttachments(html: string) {
  // Resend marks an attachment inline (and binds it to a `cid:` reference in the
  // HTML) only when the field is named `contentId`. It was previously
  // `inlineContentId`, which Resend ignores — so the marks were sent as plain
  // attachments with no Content-ID, rendering as broken images in the header while
  // the files showed up in the attachment list.
  const attachments: { filename: string; content: Buffer; contentType: string; contentId: string }[] = [];
  for (const [motif, b64] of Object.entries(EMAIL_HEROES)) {
    if (html.includes(`cid:hero-${motif}`)) {
      attachments.push({ filename: `kclinics-${motif}.gif`, content: Buffer.from(b64, 'base64'), contentType: 'image/gif', contentId: `hero-${motif}` });
    }
  }
  if (html.includes('cid:kmark')) {
    attachments.push({ filename: 'k-mark.png', content: Buffer.from(K_MARK_LIGHT_B64, 'base64'), contentType: 'image/png', contentId: 'kmark' });
  }
  if (html.includes('cid:kbadge')) {
    attachments.push({ filename: 'k-badge.png', content: Buffer.from(K_BADGE_B64, 'base64'), contentType: 'image/png', contentId: 'kbadge' });
  }
  if (html.includes('cid:kwordmark')) {
    attachments.push({ filename: 'k-clinics.png', content: Buffer.from(K_WORDMARK_LIGHT_B64, 'base64'), contentType: 'image/png', contentId: 'kwordmark' });
  }
  return attachments.length ? { attachments } : {};
}

// ── Branded HTML shell ───────────────────────────────────────────────────────

/** Premium, on-brand HTML shell for all emails. The header K mark rides along
 *  as an inline (cid:) attachment — email clients don't render inline SVG, and a
 *  cid image always shows regardless of whether a hosted URL is reachable.
 *  `logoUrl` lets a caller override the header mark with a brand-kit logo URL. */
export function emailShell(opts: { preheader?: string; body: string; unsubUrl?: string; logoUrl?: string }): string {
  const { preheader = '', body, unsubUrl } = opts;
  // Default to the bundled inline mark (cid:kmark); a brand-kit override uses its URL.
  const markSrc = opts.logoUrl || 'cid:kmark';
  const year = new Date().getFullYear();
  // Descriptor stays accurate to what we can lawfully advertise: dentistry only
  // appears once a GDC-registered dentist is in post (site.dentistryLive).
  const descriptor = site.dentistryLive ? 'Aesthetics &middot; Dentistry &middot; London' : 'Aesthetics &middot; Laser &middot; London';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="x-apple-disable-message-reformatting">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,400&display=swap" rel="stylesheet">
  <style>
    /* Progressive enhancement — clients that strip this fall back to the inline
       styles (Georgia headings, no motion). Fraunces is the brand display face;
       it loads in Apple Mail / iOS / web preview and degrades to Georgia elsewhere. */
    a{color:#8a6e54;}
    h1,.kc-display{font-family:'Fraunces',Georgia,'Times New Roman',serif !important;font-weight:600;letter-spacing:-0.4px;line-height:1.14;}
    .kc-btn:hover{background:#8a6e54 !important;box-shadow:0 12px 30px -10px rgba(42,36,32,0.55) !important;}
    @media (prefers-reduced-motion: no-preference){
      .kc-card{animation:kcRise .9s cubic-bezier(.16,1,.3,1) both;}
      .kc-fade{animation:kcFade 1.1s ease both;animation-delay:.18s;}
      .kc-btn{transition:background .25s ease,box-shadow .25s ease;}
      .kc-sheen{background-size:220% 100% !important;animation:kcSheen 5s ease-in-out infinite;}
      @keyframes kcRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      @keyframes kcFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      @keyframes kcSheen{0%{background-position:0% 0}50%{background-position:100% 0}100%{background-position:0% 0}}
    }
    @media (max-width:600px){ .kc-pad{padding:32px 26px 30px !important;} }
  </style></head>
<body style="margin:0;padding:0;background:#e8dccd;font-family:Georgia,'Times New Roman',serif;color:#2a2420;-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8dccd;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" class="kc-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#f7eee4;border-radius:18px;overflow:hidden;border:1px solid rgba(42,36,32,0.08);box-shadow:0 20px 52px -30px rgba(42,36,32,0.5);">
        <!-- Header -->
        <tr><td style="background:#2a2420;padding:44px 40px 34px;text-align:center;">
          <img src="${markSrc}" width="54" height="54" alt="" style="display:inline-block;width:54px;height:54px;border:0;outline:none;">
          <div style="margin-top:8px;line-height:0;">
            <img src="cid:kwordmark" width="188" alt="K Clinics" style="display:inline-block;width:188px;max-width:58%;height:auto;border:0;outline:none;">
          </div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:3.5px;color:#c2a589;margin-top:18px;text-transform:uppercase;">${descriptor}</div>
        </td></tr>
        <!-- Gold hairline accent (animated sheen where supported) -->
        <tr><td class="kc-sheen" style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#856a4a,#dcc4a8,#a98a6d,#dcc4a8,#856a4a);">&nbsp;</td></tr>
        <!-- Body -->
        <tr><td class="kc-pad kc-fade" style="padding:46px 46px 40px;font-size:16px;line-height:1.75;color:#3d352f;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:30px 40px 34px;background:#efe4db;border-top:1px solid rgba(42,36,32,0.06);font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7d6259;text-align:center;line-height:1.7;">
          <!-- Image-free monogram so the footer never shows a broken image -->
          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px;"><tr>
            <td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;border:1px solid #c2a589;border-radius:50%;font-family:Georgia,'Times New Roman',serif;font-size:19px;color:#a98a6d;line-height:38px;mso-line-height-rule:exactly;">K</td>
          </tr></table>
          <div style="color:#5b4f47;">${site.address.street}, ${site.address.locality}, ${site.address.region} ${site.address.postalCode}</div>
          <div style="margin-top:5px;">
            <a href="${site.phoneHref}" style="color:#8a6e54;text-decoration:none;">${site.phone}</a>
            &nbsp;&middot;&nbsp;
            <a href="mailto:${site.email}" style="color:#8a6e54;text-decoration:none;">${site.email}</a>
          </div>
          ${unsubUrl ? `<div style="margin-top:16px;font-size:11px;color:#a3917f;">You're receiving this as a KClinics member. <a href="${unsubUrl}" style="color:#a3917f;text-decoration:underline;">Unsubscribe</a></div>` : ''}
        </td></tr>
      </table>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9a8a7c;margin-top:18px;">&copy; ${year} ${site.legalName}</div>
    </td></tr>
  </table>
</body></html>`;
}

const btn = (href: string, label: string) =>
  `<a href="${href}" class="kc-btn" style="display:inline-block;background:#a98a6d;color:#fff;text-decoration:none;padding:14px 30px;border-radius:999px;font-family:Helvetica,Arial,sans-serif;font-size:14px;letter-spacing:0.4px;box-shadow:0 8px 22px -12px rgba(42,36,32,0.55);">${label}</a>`;

const btnOutline = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;border:1px solid #a98a6d;color:#856a4a;text-decoration:none;padding:12px 24px;border-radius:999px;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:0.4px;">${label}</a>`;

/** Per-type animated brand hero band (cid GIF; first frame is a clean static fallback). */
const heroBand = (motif: keyof typeof EMAIL_HEROES = 'confirmed') =>
  `<img src="cid:hero-${motif}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:14px;margin:0 0 28px;border:0;outline:none;">`;

/** A pill checklist item with a gold tick. */
const checkItem = (text: string) =>
  `<tr><td valign="top" style="padding:5px 10px 5px 0;color:#a98a6d;font-size:15px;">✓</td><td style="padding:5px 0;font-size:14px;color:#3d352f;">${text}</td></tr>`;

/** Google-Calendar "add event" link, built from the appointment details. */
function gcalUrl(o: { title: string; start: Date; end: Date; details?: string; location?: string }): string {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: o.title, dates: `${f(o.start)}/${f(o.end)}`, details: o.details || '', location: o.location || '' });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// ── Templates ────────────────────────────────────────────────────────────────
export function tmplConsultReply(firstName: string) {
  return emailShell({
    preheader: 'Thank you for your enquiry — we will be in touch shortly.',
    body: `${heroBand('welcome')}
    <h1 style="font-size:26px;margin:0 0 16px;color:#2a2420;">Thank you, ${escape(firstName)}.</h1>
    <p>We have received your consultation request and a member of our team will be in touch very shortly to arrange your complimentary consultation.</p>
    <p>In the meantime, you are warmly invited to explore our treatments, or simply reply to this email with any questions.</p>
    <p style="margin:28px 0;">${btn(site.url + '/treatments', 'Explore treatments')}</p>
    <p style="color:#91766e;font-size:14px;">As a new client, enjoy <strong>15% off your first visit</strong>.</p>
    <p style="margin-top:24px;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplPasswordReset(firstName: string, resetUrl: string) {
  return emailShell({
    preheader: 'Reset your KClinics password',
    body: `${heroBand('secure')}
    <h1 style="font-size:24px;margin:0 0 16px;color:#2a2420;">Reset your password</h1>
    <p>Hello ${escape(firstName)},</p>
    <p>We received a request to reset the password for your KClinics account. Click below to choose a new one — the link is valid for 60 minutes.</p>
    <p style="margin:28px 0;">${btn(resetUrl, 'Reset my password')}</p>
    <p style="color:#91766e;font-size:14px;">If you didn’t request this, you can safely ignore this email — your password won’t change.</p>
    <p style="margin-top:24px;">With warmth,<br>The KClinics team</p>`,
  });
}

// BLD-527: staff-issued passwordless login link for a client who has no password
// yet (e.g. created manually by the clinic). Clicking it opens their account; they
// can set a password later from their profile if they want one.
export function tmplPortalInvite(firstName: string, activateUrl: string) {
  return emailShell({
    preheader: 'Your KClinics account is ready — open it with this secure link',
    body: `${heroBand('secure')}
    <h1 style="font-size:24px;margin:0 0 16px;color:#2a2420;">Open your KClinics account</h1>
    <p>Hello ${escape(firstName)},</p>
    <p>Your KClinics account is ready. Tap below to open it — no password needed. You can manage your appointments, save a card and set a password for next time if you’d like one.</p>
    <p style="margin:28px 0;">${btn(activateUrl, 'Open my account')}</p>
    <p style="color:#91766e;font-size:14px;">This is a private link just for you — please don’t share it. It’s valid for 7 days.</p>
    <p style="margin-top:24px;">With warmth,<br>The KClinics team</p>`,
  });
}

// BLD-751: sent when an admin creates a new staff account, so credentials no
// longer have to be relayed out-of-band. The temporary password is shown once,
// with a strong prompt to change it after first login.
export function tmplStaffWelcome(o: { name: string; email: string; tempPassword: string; loginUrl: string }) {
  return emailShell({
    preheader: 'Your K Clinics staff account is ready',
    body: `${heroBand('secure')}
    <h1 style="font-size:24px;margin:0 0 16px;color:#2a2420;">Your K Clinics staff account</h1>
    <p>Hello ${escape(o.name)},</p>
    <p>An account has been set up for you on the K Clinics admin. Here are your sign-in details:</p>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3d352f;line-height:1.8;margin:16px 0;">
      <tr><td style="color:#91766e;padding-right:16px;">Email</td><td><strong>${escape(o.email)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Temporary password</td><td><strong>${escape(o.tempPassword)}</strong></td></tr>
    </table>
    <p style="margin:28px 0;">${btn(o.loginUrl, 'Sign in')}</p>
    <p style="color:#91766e;font-size:14px;">Please sign in and change this password from your profile as soon as possible.</p>
    <p style="margin-top:24px;">With warmth,<br>The K Clinics team</p>`,
  });
}

export function tmplClinicNotify(data: {
  name: string; email: string; phone?: string; category: string; treatments: string[]; message?: string;
}) {
  return emailShell({
    preheader: `New consultation: ${data.name}`,
    body: `<h1 style="font-size:22px;margin:0 0 16px;">New consultation enquiry</h1>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3d352f;line-height:1.8;">
      <tr><td style="color:#91766e;padding-right:16px;">Name</td><td><strong>${escape(data.name)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Email</td><td>${escape(data.email)}</td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Phone</td><td>${escape(data.phone || '—')}</td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Interest</td><td>${escape(data.category)}</td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Treatments</td><td>${escape(data.treatments.join(', ') || '—')}</td></tr>
    </table>
    ${data.message ? `<p style="margin-top:16px;background:#efe3d7;padding:14px 16px;border-radius:10px;">${escape(data.message)}</p>` : ''}
    <p style="margin:24px 0 0;">${btn(site.url + '/admin/consultations', 'Open in CRM')}</p>`,
  });
}

export function tmplBirthday(firstName: string, unsubUrl: string) {
  return emailShell({
    preheader: 'A little something for your birthday',
    unsubUrl,
    body: `${heroBand('birthday')}
    <h1 style="font-size:26px;margin:0 0 16px;">Happy birthday, ${escape(firstName)}.</h1>
    <p>From all of us at KClinics — we hope your day is wonderful.</p>
    <p>To celebrate, we would love to treat you to a <strong>complimentary upgrade</strong> on your next visit this month. Simply mention this email when you book.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Book your visit')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplFollowUp(firstName: string, treatment: string, unsubUrl: string) {
  return emailShell({
    preheader: 'How are you feeling after your visit?',
    unsubUrl,
    body: `${heroBand('followup')}
    <h1 style="font-size:24px;margin:0 0 16px;">How are you, ${escape(firstName)}?</h1>
    <p>It was a pleasure to welcome you for your ${escape(treatment)}. We wanted to check in and make sure you are delighted with your results.</p>
    <p>If you have any questions about aftercare, just reply — we are always here. When you are ready, we would love to see you again.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Book your next visit')}</p>
    <p>With warmth,<br>The KClinics team</p>
    <p style="margin-top:20px;padding-top:16px;border-top:1px solid #e8ddd4;font-size:13px;color:#6b6461;">Know someone who would love KClinics? <a href="${site.url}/refer-a-friend" style="color:#a98a6d;text-decoration:underline;">Refer a friend</a> — you both receive <strong>£25 credit</strong> towards any treatment.</p>`,
  });
}

export function tmplFollowUpQuestionnaire(o: { firstName: string; treatment: string; url: string }) {
  return emailShell({
    preheader: `How is your skin a week after your ${o.treatment}?`,
    body: `${heroBand('followup')}
    <h1 style="font-size:24px;margin:0 0 16px;">How are you getting on, ${escape(o.firstName)}?</h1>
    <p>It’s been about a week since your <strong>${escape(o.treatment)}</strong>. We’d love a quick update on how you’re feeling — it takes less than a minute, and lets us step in early if anything needs attention.</p>
    <p style="margin:28px 0;">${btn(o.url, 'Share how you’re doing')}</p>
    <p>If you have any concerns at all, this goes straight to our clinical team.</p>
    <p>With warmth,<br>The KClinics team</p>
    <p style="margin-top:20px;padding-top:16px;border-top:1px solid #e8ddd4;font-size:13px;color:#6b6461;">Know someone who would love KClinics? <a href="${site.url}/refer-a-friend" style="color:#a98a6d;text-decoration:underline;">Refer a friend</a> — you both receive <strong>£25 credit</strong> towards any treatment.</p>`,
  });
}

export function tmplWinBack(firstName: string, unsubUrl: string) {
  return emailShell({
    preheader: 'We would love to see you again',
    unsubUrl,
    body: `${heroBand('winback')}
    <h1 style="font-size:24px;margin:0 0 16px;">We have missed you, ${escape(firstName)}.</h1>
    <p>It has been a little while since your last visit, and we would love to welcome you back.</p>
    <p>As a thank you for your loyalty, enjoy a special privilege on your next treatment — reply and we will arrange it.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Rediscover KClinics')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplReviewRequest(firstName: string, link: string, treatment?: string, googleUrl?: string) {
  return emailShell({
    preheader: 'We would love your feedback',
    body: `${heroBand('review')}
    <h1 style="font-size:26px;margin:0 0 16px;">How did we do, ${escape(firstName)}?</h1>
    <p>We hope you are loving the results of your recent visit to KClinics${treatment ? ` for your ${escape(treatment)}` : ''}.</p>
    <p>If you have a moment, we would be so grateful if you could share your experience — it helps us, and helps others discover the clinic.</p>
    <p style="margin:28px 0 ${googleUrl ? '12px' : '28px'};">${btn(link, 'Leave a review')}</p>
    ${googleUrl ? `<p style="margin:0 0 24px;font-size:14px;color:#7d6259;">Happy to post on Google too? <a href="${googleUrl}" style="color:#856a4a;font-weight:600;">Leave us a Google review</a> — it means the world to a new clinic.</p>` : ''}
    <p>It only takes a minute, from any device.</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

// BLD-354: post-booking nurture sequence — day-0 aftercare, day-14 satisfaction
// check, day-45 re-book prompt (triggered on a COMPLETED booking in lib/automations).
export function tmplAftercare(firstName: string, treatment: string, unsubUrl: string) {
  return emailShell({
    preheader: 'Your aftercare and what to expect',
    unsubUrl,
    body: `${heroBand('followup')}
    <h1 style="font-size:24px;margin:0 0 16px;">Thank you for visiting us, ${escape(firstName)}.</h1>
    <p>It was a pleasure to welcome you for your ${escape(treatment)}. Here is a little aftercare to help you get the very best results:</p>
    <ul style="margin:0 0 18px;padding-left:20px;line-height:1.7;">
      <li>Keep the area clean and avoid heat, heavy exercise and direct sun for 24–48 hours.</li>
      <li>Stay hydrated, and pause active skincare (retinol, acids) for a few days unless we advised otherwise.</li>
      <li>A little redness or sensitivity is normal and usually settles quickly.</li>
    </ul>
    <p>If anything doesn't feel right, just reply to this email — it reaches our team and we are always here to help.</p>
    <p style="margin:28px 0;">${btn(site.url + '/account/assessments', 'Your aftercare &amp; forms')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplSatisfaction(firstName: string, treatment: string, unsubUrl: string) {
  return emailShell({
    preheader: 'How are your results coming along?',
    unsubUrl,
    body: `${heroBand('followup')}
    <h1 style="font-size:24px;margin:0 0 16px;">How are you getting on, ${escape(firstName)}?</h1>
    <p>It's been a couple of weeks since your ${escape(treatment)}, and we wanted to check you are happy with how things are settling.</p>
    <p>If you have any questions — or anything you'd like us to take a look at — just reply and our team will help.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Book a check-in or your next visit')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplRebook(firstName: string, treatment: string, unsubUrl: string) {
  return emailShell({
    preheader: 'Keep your results going',
    unsubUrl,
    body: `${heroBand('winback')}
    <h1 style="font-size:24px;margin:0 0 16px;">Time to top up, ${escape(firstName)}?</h1>
    <p>It's been about six weeks since your ${escape(treatment)}. For many treatments this is the sweet spot to book your next session and keep your results looking their best.</p>
    <p>We'd love to welcome you back — and if you'd like a complementary treatment to enhance your results, just ask and we'll tailor something for you.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Book your next visit')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplManual(bodyHtml: string, unsubUrl?: string) {
  return emailShell({ body: bodyHtml, unsubUrl });
}

// Single opt-in confirmation for newsletter sign-ups (incl. people without an
// account). Confirms the subscription and makes unsubscribing one click.
export function tmplNewsletterWelcome(unsubUrl: string) {
  return emailShell({
    preheader: 'You’re subscribed to KClinics — beauty notes, offers & news',
    unsubUrl,
    body: `<h1 style="font-size:24px;margin:0 0 16px;color:#2a2420;">You’re on the list</h1>
    <p>Thank you for subscribing to KClinics. You’ll receive our occasional notes on treatments, skincare and member offers — never spam, and never shared.</p>
    <p style="margin:24px 0;">${btn(site.url + '/treatments', 'Explore treatments')}</p>
    <p style="font-size:14px;color:#91766e;">You can unsubscribe at any time using the link below — no hard feelings.</p>
    <p style="margin-top:20px;">With warmth,<br>The KClinics team</p>`,
  });
}

// Secure card-on-file request for a booking taken offline (phone / walk-in), so
// it gets the same no-show protection as an online booking. No charge is taken.
export function tmplCardRequest(o: { firstName: string; treatment: string; start: Date; url: string }) {
  return emailShell({
    preheader: 'Securely save a card to confirm your appointment — no payment is taken now',
    body: `<h1 style="font-size:24px;margin:0 0 16px;">One quick step, ${escape(o.firstName)}.</h1>
    <p>To confirm your <strong>${escape(o.treatment)}</strong> on ${fmtWhen(o.start)}, please securely save a card to your booking. It takes less than a minute.</p>
    <p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">
      <strong>No payment is taken now.</strong> Your card is stored securely with our payment provider (Stripe) and is only charged when your treatment is delivered, or for a late cancellation within 24 hours — exactly the same as booking online.
    </p>
    <p style="margin:28px 0;">${btn(o.url, 'Save my card securely')}</p>
    <p style="font-size:14px;color:#91766e;">This is a private link just for your appointment — please don't share it.</p>
    <p style="margin-top:20px;">With warmth,<br>The KClinics team</p>`,
  });
}

// Migration welcome: a client whose booking was moved onto the new site (created
// via a manual/migrated booking) has no password yet, so the plain "Save a card"
// link left them with no way into their account. This single email does it all —
// welcomes them, shows their upcoming appointment, and gives one passwordless link
// that signs them in and lands them on the card-save step. No password is emailed;
// they can set one later from their profile if they want.
export function tmplAccountInvite(o: { firstName: string; treatment: string; start: Date; activateUrl: string }) {
  return emailShell({
    preheader: 'Your KClinics account is ready — open it to confirm your appointment',
    body: `<h1 style="font-size:24px;margin:0 0 16px;">Welcome to the new KClinics, ${escape(o.firstName)}.</h1>
    <p>We've moved your care across to our new website and your account is ready. Here's your upcoming appointment:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#efe3d7;border-radius:10px;">
      <tr><td style="padding:16px 18px;font-size:15px;">
        <div style="font-weight:600;color:#2a2420;">${escape(o.treatment)}</div>
        <div style="color:#7d6259;margin-top:4px;">${fmtWhen(o.start)}</div>
      </td></tr>
    </table>
    <p>Tap below to open your account — no password needed. You can securely save a card to confirm this appointment (no payment is taken now), and set a password for next time if you'd like one.</p>
    <p style="margin:28px 0;">${btn(o.activateUrl, 'Open my account')}</p>
    <p style="font-size:14px;color:#91766e;">This is a private link just for you — please don't share it.</p>
    <p style="margin-top:20px;">With warmth,<br>The KClinics team</p>`,
  });
}

// ── K Academy: offer + payment (BLD-528) ────────────────────────────────────
// Sent when staff make an offer. One-click link signs the trainee in and lands
// them on the pay page (full or deposit). No password needed.
export function tmplAcademyOffer(o: { firstName: string; courseTitle: string; pricePence: number; depositPence?: number | null; acceptUrl: string; expiresAt?: Date | null }) {
  const fee = `£${(o.pricePence / 100).toLocaleString('en-GB')}`;
  const dep = o.depositPence ? `£${(o.depositPence / 100).toLocaleString('en-GB')}` : null;
  return emailShell({
    preheader: `You've been offered a place on ${o.courseTitle} at K Academy`,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">Congratulations, ${escape(o.firstName)} — your place is ready.</h1>
    <p>We're delighted to offer you a place on <strong>${escape(o.courseTitle)}</strong> at K Academy. To secure it, accept your offer and pay below.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#efe3d7;border-radius:10px;">
      <tr><td style="padding:16px 18px;font-size:15px;">
        <div style="font-weight:600;color:#2a2420;">${escape(o.courseTitle)}</div>
        <div style="color:#7d6259;margin-top:4px;">Course fee: ${fee}${dep ? ` · or pay a ${dep} deposit to reserve your place` : ''}</div>
      </td></tr>
    </table>
    <p>You can pay in full or${dep ? ' by deposit,' : ''} by card or Klarna/Clearpay, or ask us about a payment plan or funding. The link below signs you straight into your trainee portal — no password needed.</p>
    <p style="margin:28px 0;">${btn(o.acceptUrl, 'Accept &amp; pay')}</p>
    ${o.expiresAt ? `<p style="font-size:14px;color:#91766e;">Please respond by ${fmtWhen(o.expiresAt)}.</p>` : ''}
    <p style="font-size:14px;color:#91766e;">This is a private link just for you — please don't share it.</p>
    <p style="margin-top:20px;">With warmth,<br>The K Academy team</p>`,
  });
}

// Payment confirmation / receipt for a course payment.
export function tmplAcademyPaymentReceipt(o: { firstName: string; courseTitle: string; amountPence: number; outstandingPence: number; portalUrl: string }) {
  const paid = `£${(o.amountPence / 100).toLocaleString('en-GB')}`;
  const owing = o.outstandingPence > 0 ? `£${(o.outstandingPence / 100).toLocaleString('en-GB')}` : null;
  return emailShell({
    preheader: `Payment received — ${o.courseTitle}`,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">Thank you, ${escape(o.firstName)} — payment received.</h1>
    <p>We've received your payment of <strong>${paid}</strong> for <strong>${escape(o.courseTitle)}</strong>. Your place is secured and your online theory is now unlocked in your portal.</p>
    ${owing ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">Outstanding balance: <strong>${owing}</strong>. We'll be in touch about the remaining payment${''}, or you can settle it any time from your portal.</p>` : ''}
    <p style="margin:28px 0;">${btn(o.portalUrl, 'Open my portal')}</p>
    <p style="margin-top:20px;">With warmth,<br>The K Academy team</p>`,
  });
}

// Security notice sent whenever an account password changes — so the owner of
// the inbox is alerted even if they didn't make the change.
export function tmplPasswordChanged(firstName: string) {
  return emailShell({
    preheader: 'Your KClinics password was just changed',
    body: `<h1 style="font-size:24px;margin:0 0 16px;color:#2a2420;">Your password was changed</h1>
    <p>Hello ${escape(firstName)},</p>
    <p>This is a confirmation that the password for your KClinics account was just changed.</p>
    <p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">If this <strong>wasn’t you</strong>, please reset your password again right away and contact us at <a href="mailto:${site.email}" style="color:#8a6e54;">${site.email}</a> or <a href="${site.phoneHref}" style="color:#8a6e54;">${site.phone}</a> so we can secure your account.</p>
    <p style="margin:24px 0;">${btn(site.url + '/account/login', 'Go to my account')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

// ── Gift voucher templates ───────────────────────────────────────────────────
// The card renders the buyer's chosen design (lib/gift-card-themes). A solid
// background colour is set first so Outlook (which drops linear-gradient) still
// shows an on-brand card; modern clients layer the gradient on top.
function voucherCard(amount: string, code: string, opts?: { designId?: string | null; recipientName?: string | null; message?: string | null }) {
  const t = giftCardTheme(opts?.designId);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td style="background:${t.to};background-image:linear-gradient(135deg,${t.from},${t.to});border-radius:14px;padding:26px;text-align:center;color:${t.ink};">
    <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${t.accent};">KClinics Gift</div>
    ${opts?.recipientName ? `<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;margin-top:8px;">For ${escape(opts.recipientName)}</div>` : ''}
    <div style="font-family:Georgia,serif;font-size:40px;margin:8px 0;">${amount}</div>
    ${opts?.message ? `<div style="font-family:Georgia,serif;font-style:italic;font-size:14px;opacity:.85;margin:0 auto 10px;max-width:320px;">“${escape(opts.message)}”</div>` : ''}
    <div style="font-size:11px;color:${t.accent};text-transform:uppercase;letter-spacing:2px;">Code</div>
    <div style="font-family:monospace;font-size:20px;letter-spacing:2px;margin-top:4px;">${escape(code)}</div>
  </td></tr></table>`;
}

export function tmplCustomGiftCard(o: { recipientName: string; fromName: string; amount: string; code: string; message?: string | null; designId?: string | null; viewUrl: string; claimUrl: string; packageName?: string | null }) {
  return emailShell({
    preheader: `${o.fromName} sent you a KClinics ${o.packageName || `${o.amount} gift card`}`,
    body: `${heroBand('voucher')}
    <h1 style="font-size:26px;margin:0 0 12px;">A gift for you, ${escape(o.recipientName)}.</h1>
    <p><strong>${escape(o.fromName)}</strong> has sent you ${o.packageName ? `the <strong>${escape(o.packageName)}</strong> at KClinics` : 'a KClinics gift card to spend on any of our treatments'}.</p>
    ${o.packageName ? `<p style="font-size:14px;color:#91766e;">Worth ${o.amount}, redeemable towards this package in clinic.</p>` : ''}
    ${voucherCard(o.amount, o.code, { designId: o.designId, recipientName: o.recipientName, message: o.message })}
    <p style="margin:22px 0 10px;">${btn(o.viewUrl, 'View &amp; share your card')}</p>
    <p style="margin:0 0 22px;">${btnOutline(o.claimUrl, 'Add to your account &amp; claim')}</p>
    <p style="font-size:14px;">Valid for 12 months; partial use is fine — any balance stays on your card. (Treatments are for ages 18+.)</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplGiftVoucher(o: { recipientName: string; fromName: string; amount: string; code: string; message?: string | null; bookUrl: string }) {
  return emailShell({
    preheader: `${o.fromName} sent you a ${o.amount} KClinics gift voucher`,
    body: `${heroBand('voucher')}
    <h1 style="font-size:26px;margin:0 0 12px;">A gift for you, ${escape(o.recipientName)}.</h1>
    <p><strong>${escape(o.fromName)}</strong> has sent you a KClinics gift voucher to spend on any of our treatments.</p>
    ${o.message ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-style:italic;">“${escape(o.message)}”</p>` : ''}
    ${voucherCard(o.amount, o.code)}
    <p style="font-size:14px;">Create your free account to add this gift card to your profile and use it against any treatment. Valid for 12 months; partial use is fine — any balance stays on your card. (Treatments are for ages 18+.)</p>
    <p style="margin:24px 0;">${btn(o.bookUrl, 'Create your account &amp; claim')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplGiftVoucherReceipt(o: { purchaserName: string; amount: string; code: string; recipientName?: string | null; scheduled?: boolean; deliverAt?: Date | null; designId?: string | null; packageName?: string | null }) {
  const when = o.deliverAt ? o.deliverAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return emailShell({
    preheader: o.packageName ? `Your KClinics gift — ${o.packageName}` : `Your ${o.amount} KClinics gift card`,
    body: `${heroBand('voucher')}
    <h1 style="font-size:24px;margin:0 0 12px;">Thank you, ${escape(o.purchaserName)}.</h1>
    <p>Your ${o.packageName ? `<strong>${escape(o.packageName)}</strong> gift (worth ${o.amount})` : `${o.amount} gift card`} is ready${o.recipientName ? ` for <strong>${escape(o.recipientName)}</strong>` : ''}.</p>
    ${o.scheduled ? `<p>We’ll deliver it to them on <strong>${when}</strong>.</p>` : `<p>${o.recipientName ? 'We’ve sent it to them too.' : 'Here it is to share however you like.'}</p>`}
    ${voucherCard(o.amount, o.code, { designId: o.designId })}
    <p style="font-size:14px;">Valid for 12 months. Redeemable against any treatment; partial use keeps the balance on the code.</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplKioskReward(o: { firstName: string; code: string; pct: number; days: number; bookUrl: string }) {
  return emailShell({
    preheader: `Your ${o.pct}% KClinics reward is inside — code ${o.code}`,
    body: `${heroBand('voucher')}
    <h1 style="font-size:26px;margin:0 0 12px;">Thanks for sharing, ${escape(o.firstName)}!</h1>
    <p>Here’s your reward — <strong>${o.pct}% off your first treatment</strong> at KClinics. Quote this code when you book or in clinic:</p>
    <p style="margin:22px 0;text-align:center;"><span style="display:inline-block;border:2px dashed #8a6e54;border-radius:12px;padding:14px 22px;font-family:monospace;font-size:22px;letter-spacing:2px;color:#2a2420;">${escape(o.code)}</span></p>
    <p style="font-size:14px;">Single use, valid for ${o.days} days. Treatments are for ages 18+.</p>
    <p style="margin:24px 0;">${btn(o.bookUrl, 'Book your treatment')}</p>
    <p>See you soon,<br>The KClinics team</p>`,
  });
}

// ── Staff (internal) templates ───────────────────────────────────────────────
const liRow = (s: string) => `<li style="margin:4px 0;">${escape(s)}</li>`;

export function tmplStaffDigest(o: {
  name: string; baseUrl: string;
  tasks: string[]; items: string[]; blockers: string[];
  isAdmin?: boolean; reports?: { label: string; href: string }[];
}) {
  const section = (title: string, rows: string[], empty: string) =>
    `<h2 style="font-size:15px;margin:22px 0 6px;">${title}</h2>` +
    (rows.length ? `<ul style="margin:0;padding-left:18px;font-size:14px;color:#3d352f;">${rows.map(liRow).join('')}</ul>` : `<p style="margin:0;font-size:14px;color:#91766e;">${empty}</p>`);
  return emailShell({
    preheader: `Your week at KClinics — ${o.tasks.length + o.items.length} thing${o.tasks.length + o.items.length === 1 ? '' : 's'} on your plate`,
    body: `<h1 style="font-size:24px;margin:0 0 6px;">Good morning, ${escape(o.name)}.</h1>
    <p>Here’s your week at KClinics.</p>
    ${section('Your open tasks', o.tasks, 'No open tasks — lovely.')}
    ${section('Assigned to you on the board', o.items, 'Nothing assigned on the build &amp; issues board.')}
    ${o.blockers.length ? section('⚠ Blocked — needs you', o.blockers, '') : ''}
    ${o.isAdmin && o.reports?.length ? `<h2 style="font-size:15px;margin:22px 0 6px;">Secured reports</h2><p style="margin:0 0 10px;font-size:14px;color:#91766e;">Financial &amp; performance data — unlocked with your passkey / PIN.</p>${o.reports.map((r) => `<p style="margin:6px 0;">${btnOutline(o.baseUrl + r.href, r.label)}</p>`).join('')}` : ''}
    <p style="margin:24px 0;">${btn(o.baseUrl + '/admin', 'Open the dashboard')}</p>
    <p style="font-size:13px;color:#91766e;">You’re receiving this weekly summary as a KClinics team member. An admin can turn staff digests off in Settings.</p>`,
  });
}

export function tmplStaffNudge(o: { name: string; baseUrl: string; tasks: string[]; items: string[] }) {
  const rows = [...o.tasks, ...o.items];
  return emailShell({
    preheader: `You have work waiting at KClinics`,
    body: `<h1 style="font-size:23px;margin:0 0 8px;">You have work waiting, ${escape(o.name)}.</h1>
    <p>A few things are assigned to you and we haven’t seen you in a little while:</p>
    <ul style="margin:8px 0;padding-left:18px;font-size:14px;color:#3d352f;">${rows.slice(0, 8).map(liRow).join('')}</ul>
    <p style="margin:22px 0;">${btn(o.baseUrl + '/admin', 'Pick up where you left off')}</p>
    <p style="font-size:13px;color:#91766e;">A gentle nudge — you won’t get these more than once every few days.</p>`,
  });
}

// ── Booking templates ────────────────────────────────────────────────────────
const fmtWhen = (d: Date) =>
  d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const fmtMoney = (pence: number) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;

export function tmplBookingConfirmation(o: {
  firstName: string; treatment: string; start: Date; pricePence: number; manageUrl: string;
  formsUrl?: string; arriveEarly?: boolean; lines?: { label: string; price: string }[]; nextNote?: string;
  end?: Date; clinicianName?: string; locationName?: string; locationAddress?: string;
}) {
  const tz = { timeZone: 'Europe/London' } as const;
  const dateStr = o.start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...tz });
  const timeStr = o.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...tz });
  const end = o.end || new Date(o.start.getTime() + 60 * 60000);
  const price = o.pricePence > 0 ? fmtMoney(o.pricePence) : 'Assessed at your visit';
  const addr = o.locationAddress || `${site.address.street}, ${site.address.locality}, ${site.address.postalCode}`;
  const place = o.locationName ? `${o.locationName} — ${addr}` : addr;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`KClinics ${addr}`)}`;
  const gcal = gcalUrl({ title: `${o.treatment} · KClinics`, start: o.start, end, details: `Your ${o.treatment} at KClinics. Manage or cancel: ${o.manageUrl}`, location: addr });

  // Full-width line row: label takes the slack (wraps cleanly), price hugs the
  // right and never wraps — so nothing gets squeezed to one-word-per-line on mobile.
  const lineRow = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:5px 0;vertical-align:top;">${label}</td><td style="padding:5px 0 5px 12px;text-align:right;white-space:nowrap;vertical-align:top;${strong ? 'font-weight:bold;' : ''}">${value}</td></tr>`;
  const itemsRows = o.lines && o.lines.length > 0
    ? o.lines.map((l) => lineRow(escape(l.label), escape(l.price))).join('')
    : lineRow(escape(o.treatment), price);
  // Stacked block (small uppercase label above a full-width value) — reflows
  // perfectly on narrow screens, used for the longer address / clinician fields.
  const block = (label: string, value: string) =>
    `<p style="margin:13px 0 0;font-family:Helvetica,Arial,sans-serif;"><span style="display:block;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#a98a6d;">${label}</span><span style="font-size:14px;line-height:1.5;color:#3d352f;">${value}</span></p>`;

  return emailShell({
    preheader: `You're booked in for ${dateStr} at ${timeStr}`,
    body: `${heroBand()}
    <h1 style="font-size:27px;margin:0 0 14px;">You're booked in, ${escape(o.firstName)}.</h1>
    <p>We can't wait to welcome you to KClinics. Here are your appointment details:</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr><td style="background:#ffffff;border:1px solid rgba(42,36,32,0.10);border-radius:14px;padding:22px 24px;box-shadow:0 8px 24px -18px rgba(42,36,32,0.4);">
      <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a98a6d;">Your appointment</p>
      <p class="kc-display" style="margin:0;font-size:25px;line-height:1.15;color:#2a2420;">${dateStr}</p>
      <p class="kc-display" style="margin:1px 0 16px;font-size:19px;color:#856a4a;">${timeStr}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3d352f;">
        ${itemsRows}
        <tr><td colspan="2" style="border-top:1px solid rgba(42,36,32,0.08);padding-top:6px;"></td></tr>
        ${lineRow('<span style="color:#91766e;">Total</span>', price, true)}
      </table>
      ${o.clinicianName ? block('With', `<strong>${escape(o.clinicianName)}</strong>`) : ''}
      ${block('Where', `${escape(place)} · <a href="${mapsUrl}" style="color:#856a4a;">map</a>`)}
    </td></tr></table>

    <p style="margin:0 0 22px;">${btnOutline(gcal, 'Add to Google Calendar')} <span style="font-size:12px;color:#91766e;">· an invite is attached for Apple&nbsp;Mail &amp; Outlook</span></p>

    <p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">
      Your card is securely saved — <strong>no payment is taken now</strong>. You're only charged when your treatment is delivered.
      Cancellations are free up to <strong>24 hours</strong> before; within 24 hours the full fee applies.
    </p>

    <h2 class="kc-display" style="font-size:18px;margin:26px 0 10px;">Before your visit</h2>
    <table style="font-family:Helvetica,Arial,sans-serif;">
      ${o.arriveEarly ? checkItem('<strong>Arrive 15 minutes early</strong> so your clinician can talk through everything with you.') : checkItem('Pop in a couple of minutes before your time.')}
      ${o.formsUrl ? checkItem('Complete your quick pre-treatment forms (or in clinic on arrival).') : ''}
      ${checkItem('Come with clean skin where possible, and a list of any medications or recent treatments.')}
      ${checkItem('Need to change it? Manage your booking any time using the button below.')}
    </table>
    ${o.formsUrl ? `<p style="margin:16px 0;">${btn(o.formsUrl, 'Complete my forms')}</p>` : ''}

    ${o.nextNote ? `<p style="font-size:14px;color:#5b4f47;border-left:2px solid #c2a589;padding-left:14px;margin:20px 0;">${escape(o.nextNote)}</p>` : ''}
    <p style="margin:22px 0;">${btn(o.manageUrl, 'Manage or cancel booking')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

/** Build an .ics calendar invite for a booking (attach to the confirmation email). */
export function bookingIcs(o: { id: string; treatment: string; start: Date; end?: Date; manageUrl: string; locationAddress?: string }): string {
  const end = o.end || new Date(o.start.getTime() + 60 * 60000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fold = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const loc = o.locationAddress || `${site.address.street}, ${site.address.locality}, ${site.address.postalCode}`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KClinics//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:booking-${o.id}@kclinics.co.uk`, `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(o.start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${fold(`${o.treatment} · KClinics`)}`,
    `LOCATION:${fold(loc)}`,
    `DESCRIPTION:${fold(`Your ${o.treatment} at KClinics. Manage or cancel: ${o.manageUrl}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:KClinics appointment reminder', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export function tmplBookingNotify(o: { name: string; email: string; phone?: string; treatment: string; start: Date; pricePence: number }) {
  return emailShell({
    preheader: `New booking: ${o.name} — ${o.treatment}`,
    body: `<h1 style="font-size:22px;margin:0 0 16px;">New booking</h1>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3d352f;line-height:1.9;">
      <tr><td style="color:#91766e;padding-right:16px;">Client</td><td><strong>${escape(o.name)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Email</td><td>${escape(o.email)}</td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Phone</td><td>${escape(o.phone || '—')}</td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Treatment</td><td>${escape(o.treatment)}</td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">When</td><td>${fmtWhen(o.start)}</td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Price</td><td>${o.pricePence > 0 ? fmtMoney(o.pricePence) : 'On consultation'}</td></tr>
    </table>
    <p style="margin:24px 0 0;">${btn(site.url + '/admin/bookings', 'Open in CRM')}</p>`,
  });
}

export function tmplBookingCancelled(o: { firstName: string; treatment: string; start: Date; feeCharged?: number; feeDeclined?: number }) {
  const fee = o.feeCharged
    ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">As this cancellation was within 24 hours of your appointment, a late-cancellation fee of <strong>${fmtMoney(o.feeCharged)}</strong> has been charged to your card on file.</p>`
    : o.feeDeclined
    ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">As this cancellation was within 24 hours of your appointment, a late-cancellation fee of <strong>${fmtMoney(o.feeDeclined)}</strong> is due, but the card on file declined the charge. We'll be in touch to arrange collection — no further action is needed from you right now.</p>`
    : `<p>No charge has been taken. We hope to welcome you another time.</p>`;
  return emailShell({
    preheader: `Your ${o.treatment} booking has been cancelled`,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">Booking cancelled</h1>
    <p>Hi ${escape(o.firstName)}, your <strong>${escape(o.treatment)}</strong> appointment on ${fmtWhen(o.start)} has been cancelled.</p>
    ${fee}
    <p style="margin:24px 0;">${btn(site.url + '/book', 'Book again')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplBookingRescheduled(o: {
  firstName: string;
  treatment: string;
  oldStart: Date;
  newStart: Date;
  feeCharged?: number;
  reschedulesLeft: number;
}) {
  const fee = o.feeCharged
    ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">As you have used your three free reschedules, a fee of <strong>${fmtMoney(o.feeCharged)}</strong> has been charged to your card on file.</p>`
    : o.reschedulesLeft > 0
    ? `<p style="font-size:13px;color:#91766e;">You have <strong>${o.reschedulesLeft}</strong> free reschedule${o.reschedulesLeft === 1 ? '' : 's'} remaining on this booking.</p>`
    : `<p style="font-size:13px;color:#91766e;">This was your last free reschedule. Any further changes will incur the full treatment fee.</p>`;
  return emailShell({
    preheader: `Your ${o.treatment} appointment has been rescheduled`,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">Appointment rescheduled</h1>
    <p>Hi ${escape(o.firstName)}, your <strong>${escape(o.treatment)}</strong> appointment has been moved.</p>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#3d352f;line-height:1.9;margin:16px 0;">
      <tr><td style="color:#91766e;padding-right:16px;">Was</td><td><s>${fmtWhen(o.oldStart)}</s></td></tr>
      <tr><td style="color:#91766e;padding-right:16px;">Now</td><td><strong>${fmtWhen(o.newStart)}</strong></td></tr>
    </table>
    ${fee}
    <p style="font-size:13px;color:#91766e;">To cancel or reschedule again, visit your booking management page or call us on 020 8050 0750.</p>
    <p style="margin:24px 0 0;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplChargeReceipt(o: {
  firstName: string;
  treatment: string;
  pricePence: number;
  late?: boolean;
  vat?: { netPence: number; vatPence: number; ratePct: number } | null;
  // Richer, itemised receipt detail (all optional — falls back to a single line).
  items?: { label: string; pricePence: number }[];
  clinician?: string | null;
  dateLabel?: string | null;
  paymentMethod?: string | null;
  reference?: string | null;
  discountPence?: number | null;
}) {
  const lc = 'font-family:Helvetica,Arial,sans-serif;';
  const muted = 'color:#91766e;';
  // Itemised lines — the booked treatment(s) and any add-ons. Late fees are a
  // single line; otherwise fall back to the primary treatment when no items.
  const lines = o.late
    ? [{ label: 'Late-cancellation fee', pricePence: o.pricePence }]
    : (o.items && o.items.length ? o.items : [{ label: o.treatment, pricePence: o.pricePence }]);
  const itemRows = lines.map((it, i) => `
        <tr>
          <td style="padding:11px 0 11px;${i ? 'border-top:1px solid rgba(42,36,32,0.08);' : ''}color:#3d352f;">${escape(it.label)}</td>
          <td align="right" style="padding:11px 0 11px;${i ? 'border-top:1px solid rgba(42,36,32,0.08);' : ''}color:#3d352f;white-space:nowrap;">${fmtMoney(it.pricePence)}</td>
        </tr>`).join('');
  const totalRow = (label: string, value: string, strong = false) => `
        <tr><td style="padding:8px 0;${muted}">${label}</td><td align="right" style="padding:8px 0;${strong ? 'font-weight:700;color:#2a2420;font-size:18px;' : 'color:#3d352f;'}white-space:nowrap;">${value}</td></tr>`;
  const summaryRows = [
    o.discountPence ? totalRow('Discount', `−${fmtMoney(o.discountPence)}`) : '',
    o.vat ? totalRow('Net', fmtMoney(o.vat.netPence)) : '',
    o.vat ? totalRow(`VAT (${o.vat.ratePct}%)`, fmtMoney(o.vat.vatPence)) : '',
    totalRow('Total paid', fmtMoney(o.pricePence), true),
  ].join('');
  // Meta block (date / reference / clinician / payment method) — only what's known.
  const metaRow = (label: string, value: string) => `
        <tr><td style="padding:3px 16px 3px 0;${muted}white-space:nowrap;">${label}</td><td style="padding:3px 0;color:#3d352f;">${escape(value)}</td></tr>`;
  const meta = [
    o.dateLabel ? metaRow('Date', o.dateLabel) : '',
    o.reference ? metaRow('Reference', o.reference) : '',
    o.clinician ? metaRow('Clinician', o.clinician) : '',
    o.paymentMethod ? metaRow('Payment', o.paymentMethod) : '',
  ].join('');
  return emailShell({
    preheader: `Receipt — ${o.treatment}`,
    body: `${heroBand('receipt')}
    <h1 style="font-size:24px;margin:0 0 14px;">Thank you, ${escape(o.firstName)}.</h1>
    <p style="margin:0 0 22px;">${o.late ? 'A late-cancellation fee has been processed.' : `Your payment has been received for your <strong>${escape(o.treatment)}</strong>. Here is your receipt.`}</p>
    ${meta ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${lc}font-size:13px;line-height:1.5;margin:0 0 18px;">${meta}</table>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${lc}font-size:15px;background:#fbf5ee;border:1px solid rgba(42,36,32,0.08);border-radius:12px;padding:6px 20px;">
      <tr><td colspan="2" style="padding:14px 0 6px;font-size:10px;letter-spacing:2px;text-transform:uppercase;${muted}">Details</td></tr>
      ${itemRows}
      <tr><td colspan="2" style="padding:2px 0;border-top:2px solid rgba(42,36,32,0.12);"></td></tr>
      ${summaryRows}
    </table>
    <p style="margin:22px 0 0;font-size:13px;${muted}">${o.vat ? 'Includes VAT at the rate shown. ' : ''}Please keep this receipt for your records.${o.late ? '' : ' We hope you love your results.'}</p>
    <p style="margin-top:18px;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplRefund(o: { firstName: string; treatment: string; amountPence: number; fully?: boolean }) {
  return emailShell({
    preheader: `Refund processed — ${o.treatment}`,
    body: `${heroBand('receipt')}
    <h1 style="font-size:24px;margin:0 0 16px;">Your refund is on its way, ${escape(o.firstName)}.</h1>
    <p>We’ve processed a ${o.fully ? 'full' : 'partial'} refund for your <strong>${escape(o.treatment)}</strong>.</p>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#3d352f;line-height:2;">
      <tr><td style="color:#91766e;padding-right:20px;">Refunded</td><td><strong>${fmtMoney(o.amountPence)}</strong></td></tr>
    </table>
    <p style="margin-top:20px;">It’ll appear back on the card used, typically within 5–10 working days depending on your bank.</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplPaymentActionRequired(o: { firstName: string; treatment: string; payUrl: string; pricePence: number }) {
  return emailShell({
    preheader: 'Action needed to complete your payment',
    body: `${heroBand('secure')}
    <h1 style="font-size:24px;margin:0 0 16px;">One quick step, ${escape(o.firstName)}.</h1>
    <p>Your bank needs you to confirm the payment of <strong>${fmtMoney(o.pricePence)}</strong> for your ${escape(o.treatment)}. It only takes a moment.</p>
    <p style="margin:24px 0;">${btn(o.payUrl, 'Confirm payment')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplNoShow(o: { firstName: string; treatment: string; start: Date; rebookUrl: string; feePence?: number | null }) {
  const when = o.start.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  return emailShell({
    preheader: `Sorry we missed you — shall we rebook your ${o.treatment}?`,
    body: `${heroBand('reminder')}
    <h1 style="font-size:25px;margin:0 0 14px;">Sorry we missed you, ${escape(o.firstName)}.</h1>
    <p>We had you down for your <strong>${escape(o.treatment)}</strong> on ${when}, but it looks like we didn't see you — we hope everything's okay.</p>
    ${o.feePence ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">As the appointment was missed within our 24-hour window, a fee of <strong>${fmtMoney(o.feePence)}</strong> was applied to your card on file, in line with our cancellation policy.</p>` : ''}
    <p>We'd love to get you booked back in whenever suits — it only takes a moment.</p>
    <p style="margin:26px 0;">${btn(o.rebookUrl, 'Rebook my appointment')}</p>
    <p style="font-size:14px;color:#91766e;">If something came up, just reply to this email or call us — we're always happy to help.</p>
    <p style="margin-top:20px;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplAbandonedBooking(o: { firstName: string; treatment: string; resumeUrl: string }) {
  return emailShell({
    preheader: `Your ${o.treatment} booking is still waiting`,
    body: `${heroBand('reminder')}
    <h1 style="font-size:25px;margin:0 0 14px;">Pick up where you left off, ${escape(o.firstName)}.</h1>
    <p>You started booking a <strong>${escape(o.treatment)}</strong> with us but didn't quite finish. Your spot isn't held yet — but it only takes a moment to secure it.</p>
    <p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">No payment is taken now — your card is simply saved to hold the appointment, and you're only charged when your treatment is delivered.</p>
    <p style="margin:26px 0;">${btn(o.resumeUrl, 'Finish my booking')}</p>
    <p style="font-size:14px;color:#91766e;">If you'd rather talk it through first, just reply to this email or call us — we're happy to help.</p>
    <p style="margin-top:20px;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplPostCourse(o: { firstName: string; treatment: string; rebookUrl: string; maintenance?: string | null }) {
  return emailShell({
    preheader: `You've completed your ${o.treatment} course`,
    body: `${heroBand('confirmed')}
    <h1 style="font-size:25px;margin:0 0 14px;">Course complete, ${escape(o.firstName)} 🎉</h1>
    <p>Congratulations — you've finished your full course of <strong>${escape(o.treatment)}</strong>. We hope you're delighted with your results, and it's been a pleasure looking after you.</p>
    ${o.maintenance ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">To keep your results looking their best, we'd suggest a maintenance session in <strong>${escape(o.maintenance)}</strong>. We’ll be ready when you are.</p>` : ''}
    <p style="margin:26px 0;">${btn(o.rebookUrl, 'Book a maintenance visit')}</p>
    <p style="font-size:14px;color:#91766e;">Questions about aftercare or what's next? Just reply — we're always here.</p>
    <p style="margin-top:20px;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplNps(o: { firstName: string; treatment?: string; baseUrl: string; token: string }) {
  const scale = Array.from({ length: 11 }, (_, n) =>
    `<td style="padding:2px;"><a href="${o.baseUrl}/nps/${o.token}?s=${n}" style="display:block;width:32px;line-height:34px;text-align:center;border:1px solid #c2a589;border-radius:8px;color:#856a4a;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;">${n}</a></td>`).join('');
  return emailShell({
    preheader: 'One quick tap — how likely are you to recommend us?',
    body: `${heroBand('review')}
    <h1 style="font-size:24px;margin:0 0 14px;">How are we doing, ${escape(o.firstName)}?</h1>
    <p>Thank you for visiting KClinics${o.treatment ? ` for your ${escape(o.treatment)}` : ''}. How likely are you to recommend us to a friend or family member?</p>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto;"><tr>${scale}</tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#91766e;"><tr><td style="text-align:left;">Not likely</td><td style="text-align:right;">Very likely</td></tr></table>
    <p style="font-size:14px;color:#91766e;margin-top:18px;">One tap is all it takes — you can add a comment afterwards if you'd like.</p>
    <p style="margin-top:18px;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplChatReply(o: { visitorName?: string | null; who: string; body: string }) {
  return emailShell({
    preheader: o.body.slice(0, 120),
    body: `${heroBand('chat')}
    <h1 style="font-size:24px;margin:0 0 16px;">A reply from KClinics</h1>
    <p>Hi${o.visitorName ? ` ${escape(o.visitorName)}` : ''} — you were chatting with us and stepped away, so here's the reply from ${escape(o.who)}:</p>
    <div style="margin:18px 0;padding:16px 18px;background:#efe3d7;border-radius:12px;white-space:pre-wrap;color:#2a2420;">${escape(o.body)}</div>
    <p style="color:#7d6259;font-size:14px;"><strong>Just reply to this email</strong> — your message goes straight back to the same conversation and we'll pick it up from there.</p>
    <p style="margin-top:22px;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplChatTranscript(o: { visitorName: string | null; messages: { sender: string; authorName: string | null; body: string; createdAt: Date }[] }) {
  const row = (m: { sender: string; authorName: string | null; body: string; createdAt: Date }) => {
    const t = m.createdAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const who = m.sender === 'VISITOR' ? (o.visitorName || 'You') : m.sender === 'AI' ? 'K · Assistant' : (m.authorName || 'KClinics');
    const bg = m.sender === 'VISITOR' ? '#efe3d7' : '#ffffff';
    return `<div style="margin:0 0 10px;"><p style="margin:0 0 3px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#a98a6d;">${escape(who)} · ${t}</p><div style="padding:10px 14px;background:${bg};border:1px solid rgba(42,36,32,0.08);border-radius:10px;white-space:pre-wrap;font-size:14px;color:#3d352f;">${escape(m.body)}</div></div>`;
  };
  const rows = o.messages.filter((m) => m.body.trim() && !m.body.startsWith('📧')).map(row).join('');
  return emailShell({
    preheader: 'A copy of your conversation with KClinics',
    body: `${heroBand('chat')}
    <h1 style="font-size:24px;margin:0 0 14px;">Your conversation${o.visitorName ? `, ${escape(o.visitorName)}` : ''}</h1>
    <p>Here's a copy of your chat with KClinics, for your records.</p>
    <div style="margin:18px 0;">${rows || '<p style="color:#91766e;">No messages yet.</p>'}</div>
    <p style="color:#7d6259;font-size:14px;"><strong>Reply to this email</strong> any time to pick the conversation back up with our team.</p>
    <p style="margin-top:20px;">With warmth,<br>The KClinics team</p>`,
  });
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ── Care-related (transactional) reminders ──────────────────────────────────
export function tmplAppointmentReminder(o: { firstName: string; treatment: string; start: Date; manageUrl: string }) {
  return emailShell({
    preheader: `Reminder: your ${o.treatment} is tomorrow`,
    body: `${heroBand('reminder')}
    <h1 style="font-size:24px;margin:0 0 16px;">See you soon, ${escape(o.firstName)}.</h1>
    <p>This is a gentle reminder of your upcoming appointment at KClinics:</p>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#3d352f;line-height:2;">
      <tr><td style="color:#91766e;padding-right:20px;">Treatment</td><td><strong>${escape(o.treatment)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:20px;">When</td><td><strong>${fmtWhen(o.start)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:20px;">Where</td><td>4 Charterhouse Buildings, Goswell Road, London EC1M 7AN</td></tr>
    </table>
    <p style="margin:24px 0;">${btn(o.manageUrl, 'Manage your appointment')}</p>
    <p style="font-size:14px;color:#91766e;">Need to reschedule? You can do so free of charge up to 24 hours before. We look forward to welcoming you.</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

// Consent signing link sent directly to the client (BLD-505): staff issue a
// consent form from the appointment and email the private signing link.
export function tmplConsentRequest(o: { firstName: string; formTitle: string; url: string }) {
  return emailShell({
    preheader: 'Please read and sign your consent form before your treatment',
    body: `${heroBand('forms')}
    <h1 style="font-size:24px;margin:0 0 16px;">One quick step before your treatment, ${escape(o.firstName)}.</h1>
    <p>Before your appointment at KClinics, please read and sign your consent form: <strong>${escape(o.formTitle)}</strong>. It takes less than a minute and can be done on your phone.</p>
    <p style="margin:28px 0;">${btn(o.url, 'Read &amp; sign my consent form')}</p>
    <p style="font-size:14px;color:#91766e;">This is a private link just for you — please don't share it. Your signed form is stored securely and sealed to your record.</p>
    <p style="margin-top:20px;">With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplFormReminder(o: { firstName: string; treatment: string; start: Date; formsUrl: string }) {
  return emailShell({
    preheader: 'Please complete your pre-treatment forms',
    body: `${heroBand('forms')}
    <h1 style="font-size:24px;margin:0 0 16px;">A quick step before your visit, ${escape(o.firstName)}.</h1>
    <p>To make your <strong>${escape(o.treatment)}</strong> on ${fmtWhen(o.start)} as smooth and safe as possible, please complete your confidential health forms beforehand — it only takes a few minutes.</p>
    <p style="margin:24px 0;">${btn(o.formsUrl, 'Complete my forms')}</p>
    <p style="font-size:14px;color:#91766e;">Your answers are encrypted and seen only by your clinical team. Completing them in advance saves time at the clinic and helps us tailor your care.</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}
