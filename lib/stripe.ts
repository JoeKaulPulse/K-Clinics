import 'server-only';
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;

// Lazily instantiated so the module is importable when Stripe isn't configured
// (e.g. the static demo). Callers should check `stripeEnabled` first.
export const stripeEnabled = Boolean(key);

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!_stripe) {
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
    _stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' });
  }
  return _stripe;
}

/** Find-or-create a Stripe customer for a client, persisting the id. */
export async function ensureCustomer(client: {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  stripeCustomerId?: string | null;
}): Promise<string> {
  if (client.stripeCustomerId) return client.stripeCustomerId;
  const { db } = await import('./db');
  const customer = await stripe().customers.create({
    email: client.email,
    name: [client.firstName, client.lastName].filter(Boolean).join(' ') || undefined,
    phone: client.phone || undefined,
    metadata: { clientId: client.id },
  });
  await db.client.update({ where: { id: client.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}
