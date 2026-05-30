'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

let _p: Promise<Stripe | null> | null = null;
export function getStripe(): Promise<Stripe | null> {
  if (!pk) return Promise.resolve(null);
  if (!_p) _p = loadStripe(pk);
  return _p;
}

export const bookingEnabled = Boolean(pk);
