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
      <input name="name" required maxLength={120} placeholder="Full name *" className={field} autoComplete="name" />
      <input name="company" maxLength={120} placeholder="Company (optional)" className={field} autoComplete="organization" />
      <input name="tradeType" maxLength={120} placeholder="Trade — e.g. electrician (optional)" className={field} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="email" type="email" maxLength={120} placeholder="Email (optional)" className={field} autoComplete="email" />
        <input name="phone" maxLength={120} placeholder="Phone (optional)" className={field} autoComplete="tel" inputMode="tel" />
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
