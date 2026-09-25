/**
 * Understated, monochrome vector payment marks for the footer. Tinted to the
 * palette (not the brands' official colours) so the row reads as a calm,
 * cohesive strip rather than a clash of logos. Accepted methods only.
 *
 * BLD-1827: Klarna and Clearpay are back, after BLD-1006 removed them. They are
 * now genuinely accepted, re-verified in code before restoring: self-service at
 * Academy enrolment (lib/academy-payments.ts), shop checkout
 * (app/api/shop/checkout/route.ts) and gift vouchers (lib/gift-vouchers.ts) --
 * all three create a PaymentIntent with automatic_payment_methods and render a
 * Stripe PaymentElement, so BNPL appears as a selectable option when eligible --
 * and on a staff-sent payment link for a treatment course or booking balance
 * (hosted Checkout surfaces whatever is enabled on the account).
 *
 * They are deliberately palette-tinted word marks like the other five, not brand
 * artwork: this strip's design contract is that no mark uses its official
 * colours. Where BNPL does and does not apply is spelled out in the "Can I pay
 * in instalments?" FAQ (lib/faqs.ts) and on /finance, so the strip stays a plain
 * list of accepted methods rather than an implied promise that every checkout
 * offers every method. Online treatment booking still takes no payment at all
 * (a SetupIntent saves a card), so it is not a BNPL surface and is not claimed
 * as one anywhere.
 */

const wrap = 'inline-flex h-7 items-center justify-center rounded-[5px] border border-white/15 bg-white/[0.05] px-2.5 text-[var(--color-porcelain)]';
const word = 'text-[0.66rem] font-semibold tracking-tight';

export function PaymentMarks({ className = '' }: { className?: string }) {
  // The whole strip is one labelled image (role="img" + aria-label); inner marks
  // are aria-hidden. This avoids aria-label on role-less <span>s (WCAG
  // aria-prohibited-attr) while announcing the accepted methods once.
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} role="img" aria-label="Accepted payment methods: Visa, Mastercard, American Express, Apple Pay, Google Pay, Klarna and Clearpay">
      {/* Visa */}
      <span className={wrap} aria-hidden><span className={`${word} italic tracking-[0.04em]`}>VISA</span></span>
      {/* Mastercard */}
      <span className={wrap} aria-hidden>
        <svg viewBox="0 0 32 20" className="h-3.5 w-auto" aria-hidden>
          <circle cx="13" cy="10" r="6.5" fill="currentColor" opacity="0.85" />
          <circle cx="19" cy="10" r="6.5" fill="currentColor" opacity="0.5" />
        </svg>
      </span>
      {/* American Express */}
      <span className={wrap} aria-hidden><span className={word}>AMEX</span></span>
      {/* Apple Pay */}
      <span className={wrap} aria-hidden>
        <svg viewBox="0 0 14 16" className="mr-1 h-3.5 w-auto" fill="currentColor" aria-hidden>
          <path d="M11.2 8.5c0-1.6 1.3-2.4 1.4-2.4-.8-1.1-1.9-1.3-2.3-1.3-1-.1-1.9.6-2.4.6s-1.3-.6-2.1-.6c-1.1 0-2.1.6-2.6 1.6-1.1 2-.3 4.9.8 6.5.5.8 1.2 1.6 2 1.6.8 0 1.1-.5 2.1-.5s1.2.5 2.1.5c.9 0 1.4-.8 1.9-1.5.6-.9.9-1.7.9-1.8 0 0-1.7-.7-1.7-2.7zM9.6 3.7c.4-.5.7-1.2.6-1.9-.6 0-1.4.4-1.8.9-.4.4-.8 1.1-.7 1.8.7.1 1.4-.3 1.9-.8z" />
        </svg>
        <span className={word}>Pay</span>
      </span>
      {/* Google Pay */}
      <span className={wrap} aria-hidden>
        <span className={`${word} mr-1`}>G</span><span className={word}>Pay</span>
      </span>
      {/* Klarna */}
      <span className={wrap} aria-hidden><span className={word}>Klarna</span></span>
      {/* Clearpay */}
      <span className={wrap} aria-hidden><span className={word}>Clearpay</span></span>
    </div>
  );
}
