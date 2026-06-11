import 'server-only';
import { cache } from 'react';
import { db, withDbRetry } from '@/lib/db';
import { hashPassword, verifyPassword, createClientSession, getClientSession } from '@/lib/auth';
import { marketingConsentFields } from '@/lib/consent';
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
  locale?: string;
  gender?: string;
  genderSelfDescribe?: string;
  ref?: string;
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
  // Accounts are open to all ages (anyone can shop). The 18+ requirement is
  // enforced at the action — booking a treatment, claiming a gift card, or
  // buying an age-restricted product — not at signup.
  const existing = await db.client.findUnique({ where: { email }, select: { passwordHash: true, source: true } });
  if (existing?.passwordHash) {
    return { ok: false, error: 'An account already exists for this email. Try signing in.' };
  }

  const { isBreachedPassword } = await import('@/lib/security/breached-password');
  if (await isBreachedPassword(input.password)) {
    return { ok: false, error: 'That password has appeared in a known data breach. Please choose a different one.' };
  }

  const emailNorm = fingerprint.email(email);
  const phoneNorm = fingerprint.phone(input.phone);
  const nameDobKey = fingerprint.nameDob(input.firstName, input.lastName, input.dob);

  // Guardrail: has an equivalent identity already claimed the discount?
  // Fault-tolerant — discount logic must never block account creation.
  let grant = true;
  try {
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
    grant = !priorClaim;
  } catch (e) {
    console.error('[signup] discount lookup failed (continuing):', (e as Error)?.message);
    grant = false; // don't grant if we can't verify; account still proceeds
  }

  const passwordHash = await hashPassword(input.password);

  // Inclusive gender capture (optional). Self-description only kept for OTHER.
  const GENDERS = ['FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY'];
  const gender = input.gender && GENDERS.includes(input.gender) ? (input.gender as never) : undefined;
  const genderSelfDescribe = input.gender === 'OTHER' ? (input.genderSelfDescribe?.trim() || undefined) : undefined;

  // Upsert the client (they may already exist as a lead/consult).
  const client = await db.client.upsert({
    where: { email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName || undefined,
      phone: input.phone || undefined,
      dob: input.dob ? new Date(input.dob) : undefined,
      gender,
      genderSelfDescribe,
      passwordHash,
      portalActive: true,
      locale: input.locale === 'uk' ? 'uk' : 'en',
      marketingOptIn: input.marketingOptIn || undefined,
      ...(input.marketingOptIn ? marketingConsentFields('registration') : {}),
      signupIp: input.ip || undefined,
      source: existing?.source ?? 'portal-signup',
    },
    create: {
      email,
      firstName: input.firstName,
      lastName: input.lastName || undefined,
      phone: input.phone || undefined,
      dob: input.dob ? new Date(input.dob) : undefined,
      gender,
      genderSelfDescribe,
      passwordHash,
      portalActive: true,
      locale: input.locale === 'uk' ? 'uk' : 'en',
      marketingOptIn: input.marketingOptIn ?? false,
      ...(input.marketingOptIn ? marketingConsentFields('registration') : {}),
      signupIp: input.ip || undefined,
      source: 'portal-signup',
    },
  });

  let code: string | undefined;
  try {
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
  } catch (e) {
    // Discount ledger issue must not fail signup — the account is created.
    console.error('[signup] discount write failed (continuing):', (e as Error)?.message);
    code = undefined;
  }

  // Loyalty: if they signed up via a friend's referral code, link it (the £25/£25
  // reward fires later, when their first ≥£100 treatment completes). Best-effort.
  if (input.ref?.trim()) {
    try {
      const { linkReferral } = await import('@/lib/client-loyalty');
      await linkReferral(input.ref, client.id, email);
    } catch (e) {
      console.error('[signup] referral link failed (continuing):', (e as Error)?.message);
    }
  }

  await createClientSession({ sub: client.id, email: client.email, firstName: client.firstName, epoch: 0 });

  return {
    ok: true,
    discount: grant
      ? { granted: true, code, percent: 15 }
      : { granted: false, percent: 15, reason: 'A welcome offer has already been used for these details.' },
  };
}

/** Tag a thrown error with the stage it failed at, so the API layer can report
 *  a safe diagnostic category without leaking details. */
function stageError(stage: string, err: unknown): Error {
  const e = new Error(`[login:${stage}] ${(err as Error)?.message || 'failed'}`);
  (e as Error & { stage?: string }).stage = stage;
  return e;
}

export async function loginClient(email: string, password: string): Promise<{ ok: boolean; error?: string; locale?: string }> {
  // Select only what we need: a default findUnique pulls every column, so any
  // not-yet-migrated column in production would throw before we can sign in.
  // Retry once on a transient connection error (serverless cold-start blip).
  let client: { id: string; email: string; firstName: string; passwordHash: string | null; locale: string; sessionEpoch: number } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      client = await db.client.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, email: true, firstName: true, passwordHash: true, locale: true, sessionEpoch: true },
      });
      break;
    } catch (err) {
      if (attempt === 1) throw stageError('lookup', err);
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  let valid = false;
  try {
    valid = !!client?.passwordHash && (await verifyPassword(password, client.passwordHash));
  } catch (err) {
    throw stageError('verify', err);
  }
  if (!valid || !client) {
    return { ok: false, error: 'Invalid email or password.' };
  }
  // Recording last-login is best-effort — a failure here (e.g. column drift)
  // must never block a valid sign-in.
  try {
    await db.client.update({ where: { id: client.id }, data: { lastLoginAt: new Date() } });
  } catch (e) {
    console.error('[login] lastLoginAt update failed (continuing):', (e as Error)?.message);
  }
  try {
    await createClientSession({ sub: client.id, email: client.email, firstName: client.firstName, epoch: client.sessionEpoch });
  } catch (err) {
    throw stageError('session', err);
  }
  return { ok: true, locale: client.locale === 'uk' ? 'uk' : 'en' };
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// Constant-time comparison of two hex digests, so a token can't be recovered by
// measuring how long the early-return mismatch takes.
const hashesEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

/** Begin a password reset. Always resolves the same way (no account enumeration);
 *  emails a one-hour reset link only if the account exists. */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const client = await db.client.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (client?.passwordHash) {
    const token = crypto.randomBytes(32).toString('hex');
    await db.client.update({
      where: { id: client.id },
      data: { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const base = process.env.NEXT_PUBLIC_SITE_URL || '';
    const url = `${base}/account/reset?token=${token}&id=${client.id}`;
    try {
      const { sendEmail, tmplPasswordReset } = await import('@/lib/email');
      const res = await sendEmail({ to: client.email, subject: 'Reset your KClinics password', html: tmplPasswordReset(client.firstName, url) });
      await db.emailEvent.create({ data: { clientId: client.id, kind: 'PASSWORD_RESET', to: client.email, subject: 'Password reset', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } });
    } catch {
      /* swallow — never reveal whether the email exists */
    }
  }
  return { ok: true };
}

/** Complete a password reset with a valid, unexpired token. */
export async function performPasswordReset(clientId: string, token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!clientId || !token || newPassword.length < 8) return { ok: false, error: 'Invalid request.' };
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client?.resetTokenHash || !client.resetTokenExp || client.resetTokenExp < new Date()) {
    return { ok: false, error: 'This reset link has expired. Please request a new one.' };
  }
  if (!hashesEqual(sha256(token), client.resetTokenHash)) return { ok: false, error: 'Invalid reset link.' };
  const { isBreachedPassword } = await import('@/lib/security/breached-password');
  if (await isBreachedPassword(newPassword)) return { ok: false, error: 'That password has appeared in a known data breach. Please choose a different one.' };
  // BLD-161: bump sessionEpoch so any outstanding portal JWTs are revoked — a
  // password reset must invalidate sessions held by whoever knew the old one.
  const updated = await db.client.update({
    where: { id: client.id },
    data: { passwordHash: await hashPassword(newPassword), resetTokenHash: null, resetTokenExp: null, portalActive: true, sessionEpoch: { increment: 1 } },
    select: { sessionEpoch: true },
  });
  await notifyPasswordChanged(client.email, client.firstName);
  await createClientSession({ sub: client.id, email: client.email, firstName: client.firstName, epoch: updated.sessionEpoch });
  return { ok: true };
}

/** Fire-and-forget security email confirming a password change. Never blocks
 *  the request or throws — notification failure must not fail the reset. */
async function notifyPasswordChanged(email: string, firstName: string): Promise<void> {
  try {
    const { sendEmail, tmplPasswordChanged } = await import('@/lib/email');
    await sendEmail({ to: email, subject: 'Your KClinics password was changed', html: tmplPasswordChanged(firstName || 'there') });
  } catch {
    // Best-effort only.
  }
}
export { notifyPasswordChanged };

/** Resolve the signed-in client (server components / route handlers).
 *  Wrapped in React `cache()` so the many callers within a single request
 *  (page + nested server components + helpers) share ONE DB lookup instead of
 *  each opening their own — this was the biggest source of connection pressure
 *  on the portal. Also retried so a transient blip during a deploy doesn't 500
 *  every authenticated page/endpoint at once. */
export const getCurrentClient = cache(async () => {
  const session = await getClientSession();
  if (!session) return null;
  const client = await withDbRetry(() => db.client.findUnique({ where: { id: session.sub } }));
  // A deactivated client loses portal access immediately — don't wait for the
  // 7-day token to expire (mirrors getCurrentStudent in lib/academy-auth.ts).
  if (client && client.portalActive === false) return null;
  return client;
});
