'use client';

import { useTransition } from 'react';
import { checkOut } from '@/app/contractor/actions';

// PRJ-63 — end the visit. Calls the server action which closes the visit and
// clears the httpOnly cookie, then redirects back to /contractor.
export function CheckOutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await checkOut(); })}
      className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/60 px-5 py-3 text-base font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-gold)] disabled:opacity-50"
    >
      {pending ? 'Ending visit…' : 'Check out / End visit'}
    </button>
  );
}
