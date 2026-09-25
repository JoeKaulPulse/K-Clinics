// BLD-1874: single source of truth for the booking-charge payment-method
// vocabulary + display labels. Used both when a payment is recorded (audit
// summaries, Booking.paymentMethod writes) and when it's displayed/corrected
// in the admin. Keep this in sync with the channel strings the checkout UI
// sends (app/api/admin/bookings/session/route.ts 'external' case) and with
// any BNPL/payment-link flow that marks a booking prepaidAt.
//
// Distinct from Booking.manualPaymentMethod (BLD-1824), which is free text
// for a package/course purchase paid outside the online booking flow — leave
// that alone.
export const PAYMENT_METHODS = {
  card: 'Card on file',
  payment_link: 'Payment link',
  cash: 'Cash',
  card_terminal: 'Card terminal',
  treatwell: 'Treatwell',
  classpass: 'ClassPass',
  gift_voucher: 'Gift voucher',
  other: 'Other',
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export const PAYMENT_METHOD_VALUES = Object.keys(PAYMENT_METHODS) as PaymentMethod[];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, value);
}

/** Human label for a stored/known method; 'other' channels fall back to the raw channel string. */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '';
  if (isPaymentMethod(method)) return PAYMENT_METHODS[method];
  return method;
}

// Maps a checkout 'channel' string (Treatwell/ClassPass/cash/card-terminal/...)
// to the vocabulary above, falling back to 'other' for anything unrecognised.
export function normalizeExternalChannel(channel: string): PaymentMethod {
  const c = channel.toLowerCase();
  if (c === 'treatwell') return 'treatwell';
  if (c === 'classpass') return 'classpass';
  if (c === 'cash') return 'cash';
  if (c === 'card-terminal' || c === 'card_terminal') return 'card_terminal';
  return 'other';
}
