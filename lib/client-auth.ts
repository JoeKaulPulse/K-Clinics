import 'server-only';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword, createClientSession, getClientSession } from '@/lib/auth';
import { fingerprint } from '@/lib/crypto';
import crypto from 'crypto';

export type SignupInput = {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  dob?: string;
  password: string;
  marketingOptIn?: boolean;
  ip?: string | null;
};

export type SignupResult =
  | { ok: true; discount: { granted: boolean; code?: string; percent: number; reason?: string } }
  | { ok: false; error: string };

/**
 * Create a client portal account. Grants a one-time 15% first-treatment
 * discount unless our guardrails detect this is a repeat claim (same email,
 * phone, or name+DOB as a prior ACTIVE/REDEEMED claim) — in which case the
 * discount is BLOCKED and flagged for staff, who can override.
 */
export async function signupClient(input: SignupInput): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.client.findUnique({ where: { email } });
  if (existing?.passwordHash) {
    return { ok: false, error: 'An account already exists for this email. Try signing in.' };
  }

  const emailNorm = fingerprint.email(email);
  const phoneNorm = fingerprint.phone(input.phone);
  const nameDobKey = fingerprint.nameDob(input.firstName, input.lastName, input.dob);

  // Guardrail: has an equivalent identity already claimed the discount?
  const priorClaim = await db.discountClaim.findFirst({
    where: {
      status: { in: ['ACTIVE', 'REDEEMED'] },
      OR: [
        { emailNorm },
        ...(phoneNorm ? [{ phoneNorm }] : []),
        ...(nameDobKey ? [{ nameDobKey }] : []),
      ],
    },
  });
  const grant = !priorClaim;

  const passwordHash = await hashPassword(input.password);

  // Upsert the client (they may already exist as a lead/consult).
  const client = await db.client.upsert({
    where: { email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName || undefined,
      phone: input.phone || undefined,
      dob: input.dob ? new Date(input.dob) : undefined,
      passwordHash,
      portalActive: true,
      marketingOptIn: input.marketingOptIn || undefined,
      signupIp: input.ip || undefined,
      source: existing?.source ?? 'portal-signup',
    },
    create: {
      email,
      firstName: input.firstName,
      lastName: input.lastName || undefined,
      phone: input.phone || undefined,
      dob: input.dob ? new Date(input.dob) : undefined,
      passwordHash,
      portalActive: true,
      marketingOptIn: input.marketingOptIn ?? false,
      signupIp: input.ip || undefined,
      source: 'portal-signup',
    },
  });

  let code: string | undefined;
  if (grant) {
    code = `KC15-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await db.discountClaim.create({
      data: { clientId: client.id, code, status: 'ACTIVE', percent: 15, emailNorm, phoneNorm, nameDobKey, ip: input.ip || undefined },
    });
    await db.client.update({ where: { id: client.id }, data: { firstDiscountClaimed: true } });
  } else {
    // Record the blocked attempt for staff visibility (flagged, no usable code).
    await db.discountClaim.create({
      data: {
        clientId: client.id,
        code: `BLOCKED-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        status: 'BLOCKED',
        percent: 15,
        emailNorm,
        phoneNorm,
        nameDobKey,
        ip: input.ip || undefined,
        flagged: true,
      },
    });
  }

  await createClientSession({ sub: client.id, email: client.email, firstName: client.firstName });

  return {
    ok: true,
    discount: grant
      ? { granted: true, code, percent: 15 }
      : { granted: false, percent: 15, reason: 'A welcome offer has already been used for these details.' },
  };
}

export async function loginClient(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  // Retry once on a transient connection error (serverless cold-start blip).
  let client = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      client = await db.client.findUnique({ where: { email: email.trim().toLowerCase() } });
      break;
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!client?.passwordHash || !(await verifyPassword(password, client.passwordHash))) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  await db.client.update({ where: { id: client.id }, data: { lastLoginAt: new Date() } });
  await createClientSession({ sub: client.id, email: client.email, firstName: client.firstName });
  return { ok: true };
}

/** Resolve the signed-in client (server components / route handlers). */
export async function getCurrentClient() {
  const session = await getClientSession();
  if (!session) return null;
  return db.client.findUnique({ where: { id: session.sub } });
}
