import 'server-only';
import * as E from '@/lib/email';
import { K_MARK_LIGHT_B64, K_WORDMARK_LIGHT_B64, K_BADGE_B64, EMAIL_HERO_GIF_B64 } from '@/lib/brand-email-assets';

// Renders every transactional/marketing email with realistic sample data so the
// whole email system is visible and on-brand in the dashboard.
export type EmailPreview = { key: string; name: string; group: string; description: string; html: string };

// A sent email carries the brand marks as inline cid: attachments, which a
// browser can't resolve — so for the dashboard preview we swap every cid for an
// equivalent data: URI (the same bundled bytes) so the marks show here too.
const forPreview = (html: string) =>
  html
    .replace(/cid:hero/g, `data:image/gif;base64,${EMAIL_HERO_GIF_B64}`)
    .replace(/cid:kwordmark/g, `data:image/png;base64,${K_WORDMARK_LIGHT_B64}`)
    .replace(/cid:kbadge/g, `data:image/png;base64,${K_BADGE_B64}`)
    .replace(/cid:kmark/g, `data:image/png;base64,${K_MARK_LIGHT_B64}`);

export function emailPreviews(): EmailPreview[] {
  const inDays = (n: number) => new Date(Date.now() + n * 86400000);
  const name = 'Olivia';
  const treatment = 'HydraFacial';
  const lines = [{ label: 'HydraFacial — Signature', price: '£120' }];

  return ([
    { key: 'consultReply', name: 'Enquiry reply', group: 'Enquiries', description: 'Auto-reply to a new website enquiry.', html: E.tmplConsultReply(name) },
    { key: 'bookingConfirmation', name: 'Booking confirmation', group: 'Bookings', description: 'Sent when a booking is confirmed.', html: E.tmplBookingConfirmation({ firstName: name, treatment, start: inDays(3), pricePence: 12000, manageUrl: '#', formsUrl: '#', arriveEarly: true, lines }) },
    { key: 'reminder', name: 'Appointment reminder', group: 'Bookings', description: 'Reminder ahead of an appointment.', html: E.tmplAppointmentReminder({ firstName: name, treatment, start: inDays(1), manageUrl: '#' }) },
    { key: 'formReminder', name: 'Forms reminder', group: 'Bookings', description: 'Nudge to complete pre-visit forms.', html: E.tmplFormReminder({ firstName: name, treatment, start: inDays(1), formsUrl: '#' }) },
    { key: 'cancelled', name: 'Booking cancelled', group: 'Bookings', description: 'Confirmation of a cancellation.', html: E.tmplBookingCancelled({ firstName: name, treatment, start: inDays(2) }) },
    { key: 'chargeReceipt', name: 'Payment receipt', group: 'Payments', description: 'Receipt after a treatment is charged.', html: E.tmplChargeReceipt({ firstName: name, treatment, pricePence: 12000 }) },
    { key: 'paymentAction', name: 'Payment action required', group: 'Payments', description: 'Card needs authentication (SCA).', html: E.tmplPaymentActionRequired({ firstName: name, treatment, payUrl: '#', pricePence: 12000 }) },
    { key: 'giftVoucher', name: 'Gift voucher', group: 'Gifting', description: 'Voucher delivered to the recipient.', html: E.tmplGiftVoucher({ recipientName: name, fromName: 'James', amount: '£150', code: 'KC-XXXX-XXXX', message: 'Enjoy! Love James x', bookUrl: '#' }) },
    { key: 'followUp', name: 'Post-treatment follow-up', group: 'Lifecycle', description: 'A warm check-in after a visit.', html: E.tmplFollowUp(name, treatment, '#') },
    { key: 'followUpQ', name: 'Aftercare check-in', group: 'Lifecycle', description: 'One-week post-visit questionnaire.', html: E.tmplFollowUpQuestionnaire({ firstName: name, treatment, url: '#' }) },
    { key: 'reviewRequest', name: 'Review request', group: 'Lifecycle', description: 'Asks a happy client for a review.', html: E.tmplReviewRequest(name, '#', treatment) },
    { key: 'birthday', name: 'Birthday offer', group: 'Marketing', description: 'A birthday treat to re-engage.', html: E.tmplBirthday(name, '#') },
    { key: 'winBack', name: 'Win-back', group: 'Marketing', description: 'Re-engages a lapsed client.', html: E.tmplWinBack(name, '#') },
    { key: 'passwordReset', name: 'Password reset', group: 'Account', description: 'Secure reset link for the portal.', html: E.tmplPasswordReset(name, '#') },
  ] as EmailPreview[]).map((p) => ({ ...p, html: forPreview(p.html) }));
}
