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
    <p style="margin:28px 0;">${btn(site.booking.treatwell, 'Book your visit')}</p>
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
    <p style="margin:28px 0;">${btn(site.booking.treatwell, 'Book your next visit')}</p>
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
    <p style="margin:28px 0;">${btn(site.booking.treatwell, 'Rediscover K Clinics')}</p>
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

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
