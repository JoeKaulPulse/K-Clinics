import 'server-only';
import { Resend } from 'resend';
import { site } from './site';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM = process.env.EMAIL_FROM || `K Clinics <hello@kclinics.co.uk>`;
const REPLY_TO = process.env.EMAIL_REPLY_TO || site.email;

export type SendResult = { ok: boolean; id?: string; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  if (!resend) return { ok: false, error: 'RESEND_API_KEY not configured' };
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo || REPLY_TO,
    });
    if (error) return { ok: false, error: String(error.message || error) };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}

// ── Branded HTML shell ───────────────────────────────────────────────────────
export function emailShell(opts: { preheader?: string; body: string; unsubUrl?: string }): string {
  const { preheader = '', body, unsubUrl } = opts;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#efe3d7;font-family:Georgia,'Times New Roman',serif;color:#2a2420;">
  <span style="display:none;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe3d7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#f6ece3;border-radius:18px;overflow:hidden;border:1px solid rgba(43,29,36,0.08);">
        <tr><td style="background:#2a2420;padding:30px 40px;text-align:center;">
          <div style="font-size:24px;letter-spacing:6px;color:#f6ece3;">K&nbsp;CLINICS</div>
          <div style="font-size:10px;letter-spacing:4px;color:#c2a589;margin-top:6px;text-transform:uppercase;">United Kingdom</div>
        </td></tr>
        <tr><td style="padding:40px;font-size:16px;line-height:1.7;color:#3d352f;">
          ${body}
        </td></tr>
        <tr><td style="padding:24px 40px;background:#efe4db;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#91766e;text-align:center;line-height:1.6;">
          ${site.address.street}, ${site.address.locality}, ${site.address.region} ${site.address.postalCode}<br>
          <a href="${site.phoneHref}" style="color:#91766e;">${site.phone}</a> ·
          <a href="mailto:${site.email}" style="color:#91766e;">${site.email}</a>
          ${unsubUrl ? `<br><br><a href="${unsubUrl}" style="color:#91766e;text-decoration:underline;">Unsubscribe</a>` : ''}
        </td></tr>
      </table>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#91766e;margin-top:18px;">© ${new Date().getFullYear()} ${site.legalName}</div>
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
    <p style="margin-top:24px;">With warmth,<br>The K Clinics team</p>`,
  });
}

export function tmplPasswordReset(firstName: string, resetUrl: string) {
  return emailShell({
    preheader: 'Reset your K Clinics password',
    body: `<h1 style="font-size:24px;margin:0 0 16px;color:#2a2420;">Reset your password</h1>
    <p>Hello ${escape(firstName)},</p>
    <p>We received a request to reset the password for your K Clinics account. Click below to choose a new one — the link is valid for 60 minutes.</p>
    <p style="margin:28px 0;">${btn(resetUrl, 'Reset my password')}</p>
    <p style="color:#91766e;font-size:14px;">If you didn’t request this, you can safely ignore this email — your password won’t change.</p>
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
    body: `<h1 style="font-size:26px;margin:0 0 16px;">Happy birthday, ${escape(firstName)}.</h1>
    <p>From all of us at K Clinics — we hope your day is wonderful.</p>
    <p>To celebrate, we would love to treat you to a <strong>complimentary upgrade</strong> on your next visit this month. Simply mention this email when you book.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Book your visit')}</p>
    <p>With warmth,<br>The K Clinics team</p>`,
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
    <p>With warmth,<br>The K Clinics team</p>`,
  });
}

export function tmplWinBack(firstName: string, unsubUrl: string) {
  return emailShell({
    preheader: 'We would love to see you again',
    unsubUrl,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">We have missed you, ${escape(firstName)}.</h1>
    <p>It has been a little while since your last visit, and we would love to welcome you back.</p>
    <p>As a thank you for your loyalty, enjoy a special privilege on your next treatment — reply and we will arrange it.</p>
    <p style="margin:28px 0;">${btn(site.url + site.booking.path, 'Rediscover K Clinics')}</p>
    <p>With warmth,<br>The K Clinics team</p>`,
  });
}

export function tmplReviewRequest(firstName: string, unsubUrl: string) {
  return emailShell({
    preheader: 'We would be grateful for your thoughts',
    unsubUrl,
    body: `<h1 style="font-size:24px;margin:0 0 16px;">Thank you, ${escape(firstName)}.</h1>
    <p>We hope you are loving your results. If you have a moment, a short review would mean the world to us — and helps others discover K Clinics.</p>
    <p style="margin:28px 0;">${btn(site.social.instagram, 'Leave a review')}</p>
    <p>With gratitude,<br>The K Clinics team</p>`,
  });
}

export function tmplManual(bodyHtml: string, unsubUrl?: string) {
  return emailShell({ body: bodyHtml, unsubUrl });
}

// ── Booking templates ────────────────────────────────────────────────────────
const fmtWhen = (d: Date) =>
  d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const fmtMoney = (pence: number) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;

export function tmplBookingConfirmation(o: { firstName: string; treatment: string; start: Date; pricePence: number; manageUrl: string }) {
  const price = o.pricePence > 0 ? fmtMoney(o.pricePence) : 'Assessed at your visit';
  return emailShell({
    preheader: `Your ${o.treatment} is booked for ${fmtWhen(o.start)}`,
    body: `<h1 style="font-size:26px;margin:0 0 16px;">You're booked in, ${escape(o.firstName)}.</h1>
    <p>We look forward to welcoming you to K Clinics.</p>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#3d352f;line-height:2;margin:8px 0;">
      <tr><td style="color:#91766e;padding-right:20px;">Treatment</td><td><strong>${escape(o.treatment)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:20px;">When</td><td><strong>${fmtWhen(o.start)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:20px;">Price</td><td>${price}</td></tr>
    </table>
    <p style="background:#efe3d7;padding:14px 16px;border-radius:10px;font-size:14px;">
      Your card is securely saved — <strong>no payment is taken now</strong>. You will only be charged when your treatment is delivered.
      Cancellations are free up to <strong>24 hours</strong> before your appointment; within 24 hours the full fee applies.
    </p>
    <p style="margin:24px 0;">${btn(o.manageUrl, 'Manage or cancel booking')}</p>
    <p>${site.address.street}, ${site.address.locality}.<br>With warmth,<br>The K Clinics team</p>`,
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
    <p>With warmth,<br>The K Clinics team</p>`,
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
    <p>With warmth,<br>The K Clinics team</p>`,
  });
}

export function tmplPaymentActionRequired(o: { firstName: string; treatment: string; payUrl: string; pricePence: number }) {
  return emailShell({
    preheader: 'Action needed to complete your payment',
    body: `<h1 style="font-size:24px;margin:0 0 16px;">One quick step, ${escape(o.firstName)}.</h1>
    <p>Your bank needs you to confirm the payment of <strong>${fmtMoney(o.pricePence)}</strong> for your ${escape(o.treatment)}. It only takes a moment.</p>
    <p style="margin:24px 0;">${btn(o.payUrl, 'Confirm payment')}</p>
    <p>With warmth,<br>The K Clinics team</p>`,
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
    <p>This is a gentle reminder of your upcoming appointment at K Clinics:</p>
    <table style="font-family:Helvetica,Arial,sans-serif;font-size:16px;color:#3d352f;line-height:2;">
      <tr><td style="color:#91766e;padding-right:20px;">Treatment</td><td><strong>${escape(o.treatment)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:20px;">When</td><td><strong>${fmtWhen(o.start)}</strong></td></tr>
      <tr><td style="color:#91766e;padding-right:20px;">Where</td><td>4 Charterhouse Buildings, Goswell Road, London EC1M 7AN</td></tr>
    </table>
    <p style="margin:24px 0;">${btn(o.manageUrl, 'Manage your appointment')}</p>
    <p style="font-size:14px;color:#91766e;">Need to reschedule? You can do so free of charge up to 24 hours before. We look forward to welcoming you.</p>
    <p>With warmth,<br>The K Clinics team</p>`,
  });
}

export function tmplFormReminder(o: { firstName: string; treatment: string; start: Date; formsUrl: string }) {
  return emailShell({
    preheader: 'Please complete your pre-treatment forms',
    body: `<h1 style="font-size:24px;margin:0 0 16px;">A quick step before your visit, ${escape(o.firstName)}.</h1>
    <p>To make your <strong>${escape(o.treatment)}</strong> on ${fmtWhen(o.start)} as smooth and safe as possible, please complete your confidential health forms beforehand — it only takes a few minutes.</p>
    <p style="margin:24px 0;">${btn(o.formsUrl, 'Complete my forms')}</p>
    <p style="font-size:14px;color:#91766e;">Your answers are encrypted and seen only by your clinical team. Completing them in advance saves time at the clinic and helps us tailor your care.</p>
    <p>With warmth,<br>The K Clinics team</p>`,
  });
}

export function tmplReviewRequest(firstName: string, link: string, treatment?: string) {
  const body = `
    <p>Hi ${firstName},</p>
    <p>Thank you for visiting ${SITE}${treatment ? ` for your ${treatment}` : ''}. It was a pleasure to care for you.</p>
    <p>Your feedback means the world to us — and helps others discover the clinic. Would you take a moment to share how it went?</p>
    <p style="text-align:center;margin:32px 0">
      <a href="${link}" style="background:#a98a6d;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600">Leave a review</a>
    </p>
