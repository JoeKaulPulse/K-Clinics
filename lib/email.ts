import 'server-only';
import { Resend } from 'resend';
import { site } from './site';
import { K_MARK_LIGHT_B64, K_BADGE_B64 } from './brand-email-assets';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM = process.env.EMAIL_FROM || `KClinics <hello@kclinics.co.uk>`;
const REPLY_TO = process.env.EMAIL_REPLY_TO || site.email;

export type SendResult = { ok: boolean; id?: string; error?: string };

// Default sender address (the part inside <…>), used to rebuild the From header
// when a campaign overrides just the display name.
const FROM_ADDRESS = (FROM.match(/<([^>]+)>/)?.[1] || FROM).trim();

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Override the From *display name* only (address stays our verified sender). */
  fromName?: string;
  /** Extra MIME headers, e.g. List-Unsubscribe for bulk marketing. */
  headers?: Record<string, string>;
}): Promise<SendResult> {
  if (!resend) return { ok: false, error: 'RESEND_API_KEY not configured' };
  try {
    const from = opts.fromName?.trim() ? `${opts.fromName.trim()} <${FROM_ADDRESS}>` : FROM;
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo || REPLY_TO,
      ...brandAttachments(opts.html),
      ...(opts.headers ? { headers: opts.headers } : {}),
    });
    if (error) return { ok: false, error: String(error.message || error) };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}

// The brand marks ride along as inline (cid:) attachments — embedded from
// bundled base64 — so the logo always renders regardless of whether an external
// URL is reachable from the recipient's mail client. Only attached when the HTML
// actually references the cid, so unrelated mail stays lean.
function brandAttachments(html: string) {
  const attachments: { filename: string; content: Buffer; contentType: string; inlineContentId: string }[] = [];
  if (html.includes('cid:kmark')) {
    attachments.push({ filename: 'k-mark.png', content: Buffer.from(K_MARK_LIGHT_B64, 'base64'), contentType: 'image/png', inlineContentId: 'kmark' });
  }
  if (html.includes('cid:kbadge')) {
    attachments.push({ filename: 'k-badge.png', content: Buffer.from(K_BADGE_B64, 'base64'), contentType: 'image/png', inlineContentId: 'kbadge' });
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="x-apple-disable-message-reformatting"></head>
<body style="margin:0;padding:0;background:#e8dccd;font-family:Georgia,'Times New Roman',serif;color:#2a2420;-webkit-font-smoothing:antialiased;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8dccd;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#f7eee4;border-radius:18px;overflow:hidden;border:1px solid rgba(42,36,32,0.08);box-shadow:0 20px 52px -30px rgba(42,36,32,0.5);">
        <!-- Header -->
        <tr><td style="background:#2a2420;padding:38px 40px 30px;text-align:center;">
          <img src="${markSrc}" width="52" height="52" alt="KClinics" style="display:inline-block;width:52px;height:52px;border:0;outline:none;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:23px;letter-spacing:8px;color:#f6ece3;margin-top:16px;padding-left:8px;">K&nbsp;CLINICS</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:9px;letter-spacing:3.5px;color:#c2a589;margin-top:9px;text-transform:uppercase;">Aesthetics &middot; Dentistry &middot; London</div>
        </td></tr>
        <!-- Gold hairline accent -->
        <tr><td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#a98a6d,#dcc4a8,#a98a6d);">&nbsp;</td></tr>
        <!-- Body -->
        <tr><td style="padding:44px 44px 38px;font-size:16px;line-height:1.75;color:#3d352f;">
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
  `<a href="${href}" style="display:inline-block;background:#a98a6d;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-family:Helvetica,Arial,sans-serif;font-size:14px;">${label}</a>`;

// ── Templates ────────────────────────────────────────────────────────────────
export function tmplConsultReply(firstName: string) {
  return emailShell({
    preheader: 'Thank you for your enquiry — we will be in touch shortly.',
    body: `<h1 style="font-size:26px;margin:0 0 16px;color:#2a2420;">Thank you, ${escape(firstName)}.</h1>
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
    body: `<h1 style="font-size:24px;margin:0 0 16px;color:#2a2420;">Reset your password</h1>
    <p>Hello ${escape(firstName)},</p>
    <p>We received a request to reset the password for your KClinics account. Click below to choose a new one — the link is valid for 60 minutes.</p>
    <p style="margin:28px 0;">${btn(resetUrl, 'Reset my password')}</p>
    <p style="color:#91766e;font-size:14px;">If you didn’t request this, you can safely ignore this email — your password won’t change.</p>
    <p style="margin-top:24px;">With warmth,<br>The KClinics team</p>`,
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
    body: `<h1 style="font-size:26px;margin:0 0 16px;">Happy birthday, ${escape(firstName)}.</h1>
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
    body: `<h1 style="font-size:24px;margin:0 0 16px;">How are you, ${escape(firstName)}?</h1>
    <p>It was a pleasure to welcome you for your ${escape(treatment)}. We wanted to check in and make sure you are delighted with your results.</p>
    <p>If you have any questions about aftercare, just reply — we are always here. When you are ready, we would love to see you again.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Book your next visit')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplFollowUpQuestionnaire(o: { firstName: string; treatment: string; url: string }) {
  return emailShell({
    preheader: `How is your skin a week after your ${o.treatment}?`,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">How are you getting on, ${escape(o.firstName)}?</h1>
    <p>It's been about a week since your <strong>${escape(o.treatment)}</strong>. We'd love a quick update on how you're feeling — it takes less than a minute, and lets us step in early if anything needs attention.</p>
    <p style="margin:28px 0;">${btn(o.url, 'Share how you’re doing')}</p>
    <p>If you have any concerns at all, this goes straight to our clinical team.</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplWinBack(firstName: string, unsubUrl: string) {
  return emailShell({
    preheader: 'We would love to see you again',
    unsubUrl,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">We have missed you, ${escape(firstName)}.</h1>
    <p>It has been a little while since your last visit, and we would love to welcome you back.</p>
    <p>As a thank you for your loyalty, enjoy a special privilege on your next treatment — reply and we will arrange it.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Rediscover KClinics')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplReviewRequest(firstName: string, link: string, treatment?: string) {
  return emailShell({
    preheader: 'We would love your feedback',
    body: `<h1 style="font-size:26px;margin:0 0 16px;">How did we do, ${escape(firstName)}?</h1>
    <p>We hope you are loving the results of your recent visit to KClinics${treatment ? ` for your ${escape(treatment)}` : ''}.</p>
    <p>If you have a moment, we would be so grateful if you could share your experience — it helps us, and helps others discover the clinic.</p>
    <p style="margin:28px 0;">${btn(link, 'Leave a review')}</p>
    <p>It only takes a minute, from any device.</p>
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
function voucherCard(amount: string, code: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td style="background:#2a2420;border-radius:14px;padding:26px;text-align:center;color:#f6ece3;">
    <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#c2a589;">KClinics Gift Voucher</div>
    <div style="font-family:Georgia,serif;font-size:40px;margin:10px 0;">${amount}</div>
    <div style="font-size:12px;color:#c2a589;text-transform:uppercase;letter-spacing:2px;">Code</div>
    <div style="font-family:monospace;font-size:20px;letter-spacing:2px;margin-top:4px;">${escape(code)}</div>
  </td></tr></table>`;
}

export function tmplGiftVoucher(o: { recipientName: string; fromName: string; amount: string; code: string; message?: string | null; bookUrl: string }) {
  return emailShell({
    preheader: `${o.fromName} sent you a ${o.amount} KClinics gift voucher`,
    body: `<h1 style="font-size:26px;margin:0 0 12px;">A gift for you, ${escape(o.recipientName)}.</h1>
    <p><strong>${escape(o.fromName)}</strong> has sent you a KClinics gift voucher to spend on any of our treatments.</p>
    ${o.message ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-style:italic;">“${escape(o.message)}”</p>` : ''}
    ${voucherCard(o.amount, o.code)}
    <p style="font-size:14px;">Create your free account to add this gift card to your profile and use it against any treatment. Valid for 12 months; partial use is fine — any balance stays on your card. (Treatments are for ages 18+.)</p>
    <p style="margin:24px 0;">${btn(o.bookUrl, 'Create your account &amp; claim')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplGiftVoucherReceipt(o: { purchaserName: string; amount: string; code: string; recipientName?: string | null; scheduled?: boolean; deliverAt?: Date | null }) {
  const when = o.deliverAt ? o.deliverAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return emailShell({
    preheader: `Your ${o.amount} KClinics gift voucher`,
    body: `<h1 style="font-size:24px;margin:0 0 12px;">Thank you, ${escape(o.purchaserName)}.</h1>
    <p>Your ${o.amount} gift voucher is ready${o.recipientName ? ` for <strong>${escape(o.recipientName)}</strong>` : ''}.</p>
    ${o.scheduled ? `<p>We’ll deliver it to them on <strong>${when}</strong>.</p>` : `<p>${o.recipientName ? 'We’ve sent it to them too.' : 'Here it is to share however you like.'}</p>`}
    ${voucherCard(o.amount, o.code)}
    <p style="font-size:14px;">Valid for 12 months. Redeemable against any treatment; partial use keeps the balance on the code.</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

// ── Booking templates ────────────────────────────────────────────────────────
const fmtWhen = (d: Date) =>
  d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const fmtMoney = (pence: number) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;

export function tmplBookingConfirmation(o: { firstName: string; treatment: string; start: Date; pricePence: number; manageUrl: string; formsUrl?: string; arriveEarly?: boolean; lines?: { label: string; price: string }[]; nextNote?: string }) {
  const price = o.pricePence > 0 ? fmtMoney(o.pricePence) : 'Assessed at your visit';
  const itemsRows = o.lines && o.lines.length > 0
    ? o.lines.map((l) => `<tr><td style="color:#91766e;padding-right:20px;">${escape(l.label)}</td><td>${escape(l.price)}</td></tr>`).join('')
    : `<tr><td style="color:#91766e;padding-right:20px;">Treatment</td><td><strong>${escape(o.treatment)}</strong></td></tr>`;
  return emailShell({
    preheader: `Your ${o.treatment} is booked for ${fmtWhen(o.start)}`,
    body: `<h1 style="font-size:26px;margin:0 0 16px;">You're booked in, ${escape(o.firstName)}.</h1>
    <p>We look forward to welcoming you to KClinics.</p>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#3d352f;line-height:2;margin:8px 0;">
      ${itemsRows}
      <tr><td style="color:#91766e;padding-right:20px;">When</td><td><strong>${fmtWhen(o.start)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:20px;">Total</td><td>${price}</td></tr>
    </table>
    <p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">
      Your card is securely saved — <strong>no payment is taken now</strong>. You will only be charged when your treatment is delivered.
      Cancellations are free up to <strong>24 hours</strong> before your appointment; within 24 hours the full fee applies.
    </p>
    ${o.arriveEarly ? `<p style="font-size:14px;">Please <strong>arrive 15 minutes early</strong> for your first appointment so your clinician can talk through your treatment with you.</p>` : ''}
    ${o.nextNote ? `<p style="font-size:14px;color:#5b4f47;border-left:2px solid #c2a589;padding-left:14px;margin:18px 0;">${escape(o.nextNote)}</p>` : ''}
    ${o.formsUrl ? `<p style="font-size:14px;">Please complete your pre-treatment forms before your visit — it only takes a few minutes (you can also do them in clinic when you arrive).</p><p style="margin:16px 0;">${btn(o.formsUrl, 'Complete my forms')}</p>` : ''}
    <p style="margin:24px 0;">${btn(o.manageUrl, 'Manage or cancel booking')}</p>
    <p>${site.address.street}, ${site.address.locality}.<br>With warmth,<br>The KClinics team</p>`,
  });
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

export function tmplBookingCancelled(o: { firstName: string; treatment: string; start: Date; feeCharged?: number }) {
  const fee = o.feeCharged
    ? `<p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">As this cancellation was within 24 hours of your appointment, a late-cancellation fee of <strong>${fmtMoney(o.feeCharged)}</strong> has been charged to your card on file.</p>`
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

export function tmplChargeReceipt(o: { firstName: string; treatment: string; pricePence: number; late?: boolean }) {
  return emailShell({
    preheader: `Receipt — ${o.treatment}`,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">Thank you, ${escape(o.firstName)}.</h1>
    <p>${o.late ? 'A late-cancellation fee has been processed' : 'Your payment has been processed'} for your <strong>${escape(o.treatment)}</strong>.</p>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#3d352f;line-height:2;">
      <tr><td style="color:#91766e;padding-right:20px;">Amount</td><td><strong>${fmtMoney(o.pricePence)}</strong></td></tr>
    </table>
    <p style="margin-top:20px;">This is your receipt. ${o.late ? '' : 'We hope you love your results.'}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

export function tmplPaymentActionRequired(o: { firstName: string; treatment: string; payUrl: string; pricePence: number }) {
  return emailShell({
    preheader: 'Action needed to complete your payment',
    body: `<h1 style="font-size:24px;margin:0 0 16px;">One quick step, ${escape(o.firstName)}.</h1>
    <p>Your bank needs you to confirm the payment of <strong>${fmtMoney(o.pricePence)}</strong> for your ${escape(o.treatment)}. It only takes a moment.</p>
    <p style="margin:24px 0;">${btn(o.payUrl, 'Confirm payment')}</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ── Care-related (transactional) reminders ──────────────────────────────────
export function tmplAppointmentReminder(o: { firstName: string; treatment: string; start: Date; manageUrl: string }) {
  return emailShell({
    preheader: `Reminder: your ${o.treatment} is tomorrow`,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">See you soon, ${escape(o.firstName)}.</h1>
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

export function tmplFormReminder(o: { firstName: string; treatment: string; start: Date; formsUrl: string }) {
  return emailShell({
    preheader: 'Please complete your pre-treatment forms',
    body: `<h1 style="font-size:24px;margin:0 0 16px;">A quick step before your visit, ${escape(o.firstName)}.</h1>
    <p>To make your <strong>${escape(o.treatment)}</strong> on ${fmtWhen(o.start)} as smooth and safe as possible, please complete your confidential health forms beforehand — it only takes a few minutes.</p>
    <p style="margin:24px 0;">${btn(o.formsUrl, 'Complete my forms')}</p>
    <p style="font-size:14px;color:#91766e;">Your answers are encrypted and seen only by your clinical team. Completing them in advance saves time at the clinic and helps us tailor your care.</p>
    <p>With warmth,<br>The KClinics team</p>`,
  });
}
