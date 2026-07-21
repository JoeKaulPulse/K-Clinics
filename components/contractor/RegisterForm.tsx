'use client';

import { useState, useTransition } from 'react';
import { registerAndCheckIn } from '@/app/contractor/actions';

// PRJ-63 — public "I'm new here" registration. Creates a PENDING contractor and
// checks them in. No account, no password — just a data row for reception.
export function RegisterForm() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const field =
    'w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 px-5 py-3 text-base font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-gold)]"
      >
        I’m new here
      </button>
    );
  }

  return (
    <form
      action={(fd) => start(async () => { await registerAndCheckIn(fd); })}
      className="space-y-3"
    >
      {/* PRJ-1032.26: a persistent visible <label> per field (placeholders alone
          disappear on input and are not a robust accessible name). */}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-ink)]">Full name <span aria-hidden="true">*</span><span className="sr-only">(required)</span></span>
        <input name="name" required maxLength={120} placeholder="Full name" className={field} autoComplete="name" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-ink)]">Company <span className="text-[var(--color-stone)]">(optional)</span></span>
        <input name="company" maxLength={120} placeholder="Company" className={field} autoComplete="organization" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--color-ink)]">Trade <span className="text-[var(--color-stone)]">(optional)</span></span>
        <input name="tradeType" maxLength={120} placeholder="e.g. electrician" className={field} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--color-ink)]">Email <span className="text-[var(--color-stone)]">(optional)</span></span>
          <input name="email" type="email" maxLength={120} placeholder="Email" className={field} autoComplete="email" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[var(--color-ink)]">Phone <span className="text-[var(--color-stone)]">(optional)</span></span>
          <input name="phone" maxLength={120} placeholder="Phone" className={field} autoComplete="tel" inputMode="tel" />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[var(--radius-md)] bg-[var(--color-ink)] px-5 py-3 text-base font-medium text-[var(--color-porcelain)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Register & sign in'}
      </button>
      <p className="text-xs text-[var(--color-stone)]">
        Reception will approve your profile shortly. You can sign in straight away.
      </p>
    </form>
  );
}
