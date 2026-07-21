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
  password?: string;   // omitted for a guest (passwordless) booking — see `guest`
  guest?: boolean;     // true → passwordless account, portal stays inactive until claimed (BLD-550)
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
  // A guest books without a password (BLD-550); the account is created
  // passwordless and claimed later via the activation email.
  const isGuest = !input.password;
  const existing = await db.client.findUnique({ where: { email }, select: { passwordHash: true, source: true } });
  if (existing?.passwordHash) {
    return { ok: false, error: 'An account already exists for this email — please sign in instead.' };
  }

  if (!isGuest) {
    const { isBreachedPassword } = await import('@/lib/security/breached-password');
    if (await isBreachedPassword(input.password!)) {
      return { ok: false, error: 'That password has appeared in a known data breach. Please choose a different one.' };
    }
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

  const passwordHash = isGuest ? undefined : await hashPassword(input.password!);

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
      // Guests are portal-active (they need the session to finish booking and to
      // see their appointment); "unclaimed" is represented by a null passwordHash.
      // They set a password later via the activation email. (BLD-550)
      portalActive: true,
      locale: input.locale === 'uk' ? 'uk' : 'en',
      marketingOptIn: input.marketingOptIn || undefined,
      ...(input.marketingOptIn ? marketingConsentFields('registration') : {}),
      signupIp: input.ip || undefined,
      source: existing?.source ?? (isGuest ? 'guest-booking' : 'portal-signup'),
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
      // Guests are portal-active (they need the session to finish booking and to
      // see their appointment); "unclaimed" is represented by a null passwordHash.
      // They set a password later via the activation email. (BLD-550)
      portalActive: true,
      locale: input.locale === 'uk' ? 'uk' : 'en',
      marketingOptIn: input.marketingOptIn ?? false,
      ...(input.marketingOptIn ? marketingConsentFields('registration') : {}),
      signupIp: input.ip || undefined,
      source: isGuest ? 'guest-booking' : 'portal-signup',
    },
  });

  // BLD-703: serialise the welcome grant so two concurrent signups can't both
  // mint an ACTIVE claim. The fingerprint read above guards cross-identity reuse
  // (email/phone/nameDob); this atomic CAS on the client's firstDiscountClaimed
  // flag closes the same-client race — exactly one concurrent writer flips
  // false→true and may create the claim, the loser is downgraded to BLOCKED.
  // Mirrors the conditional-updateMany pattern in lib/shop.ts (BLD-898).
  if (grant) {
    try {
      const won = await db.client.updateMany({ where: { id: client.id, firstDiscountClaimed: false }, data: { firstDiscountClaimed: true } });
      if (won.count === 0) grant = false; // a concurrent signup already claimed the welcome offer for this client
    } catch (e) {
      console.error('[signup] welcome-claim CAS failed (continuing, not granting):', (e as Error)?.message);
      grant = false;
    }
  }

  let code: string | undefined;
  try {
    if (grant) {
      code = `KC15-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      await db.discountClaim.create({
        data: { clientId: client.id, code, status: 'ACTIVE', percent: 15, emailNorm, phoneNorm, nameDobKey, ip: input.ip || undefined },
      });
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

export async function loginClient(email: string, password: string): Promise<{ ok: boolean; error?: string; locale?: string; firstName?: string; gender?: string | null }> {
  // Select only what we need: a default findUnique pulls every column, so any
  // not-yet-migrated column in production would throw before we can sign in.
  // Retry once on a transient connection error (serverless cold-start blip).
  // firstName/gender are returned so the booking flow can finish in place after
  // a deferred sign-in without a full reload that would wipe the selection (BLD-634).
  let client: { id: string; email: string; firstName: string; gender: string | null; passwordHash: string | null; locale: string; sessionEpoch: number } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      client = await db.client.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true, email: true, firstName: true, gender: true, passwordHash: true, locale: true, sessionEpoch: true },
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
  return { ok: true, locale: client.locale === 'uk' ? 'uk' : 'en', firstName: client.firstName, gender: client.gender };
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
  if (client) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || '';
    try {
      const { sendEmail, tmplPasswordReset, tmplPortalInvite } = await import('@/lib/email');
      if (client.passwordHash) {
        const token = crypto.randomBytes(32).toString('hex');
        await db.client.update({
          where: { id: client.id },
          data: { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + 60 * 60 * 1000) },
        });
        const url = `${base}/account/reset?token=${token}&id=${client.id}`;
        const res = await sendEmail({ to: client.email, subject: 'Reset your KClinics password', html: tmplPasswordReset(client.firstName, url) });
        await db.emailEvent.create({ data: { clientId: client.id, kind: 'PASSWORD_RESET', to: client.email, subject: 'Password reset', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } });
      } else {
        // Passwordless account (manually created / migrated): a reset link is
        // useless — there's no password to reset, so the old code sent nothing and
        // staff saw "no email received". Send an activation magic link instead so
        // they can get in and set a password from their profile. (BLD-527)
        const token = await createAccountInvite(client.id);
        if (token) {
          const url = `${base}/account/activate?token=${token}&id=${client.id}`;
          const res = await sendEmail({ to: client.email, subject: 'Access your KClinics account', html: tmplPortalInvite(client.firstName, url) });
          await db.emailEvent.create({ data: { clientId: client.id, kind: 'PASSWORD_RESET', to: client.email, subject: 'Account access link', status: res.ok ? 'SENT' : 'FAILED', providerId: res.id, error: res.error } });
        }
      }
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

// ── Passwordless account activation (migration magic link) ──────────────────
// A client whose booking was moved onto the new site has no password, so the
// self-service reset above refuses them (it only emails accounts that already
// have a password). These two helpers give such a client a way in: staff issue
// a one-time activation link, and clicking it signs them in. We reuse the same
// reset-token columns (no schema change → safe under the additive deploy gate).
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — covers a "next week" migration window

/** Issue a passwordless activation token for a client (typically one migrated in
 *  with no password). Stores the hashed token + expiry on the client and returns
 *  the plaintext token; the caller builds the /account/activate link. Returns null
 *  if the client doesn't exist. */
export async function createAccountInvite(clientId: string): Promise<string | null> {
  const exists = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!exists) return null;
  const token = crypto.randomBytes(32).toString('hex');
  await db.client.update({
    where: { id: clientId },
    data: { resetTokenHash: sha256(token), resetTokenExp: new Date(Date.now() + INVITE_TTL_MS) },
  });
  return token;
}

/** Consume an activation magic link: validate the token and mark the portal active.
 *  Does NOT require or set a password (it stays optional — they can add one later
 *  from their profile). The token remains valid until expiry so a click on a second
 *  device still works; setting a password (self-service reset / profile) clears it.
 *  Returns the minimal client identity so the caller can open a portal session. */
export async function activateAccount(
  clientId: string,
  token: string,
): Promise<{ ok: true; client: { id: string; email: string; firstName: string; sessionEpoch: number } } | { ok: false }> {
  if (!clientId || !token) return { ok: false };
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, email: true, firstName: true, sessionEpoch: true, resetTokenHash: true, resetTokenExp: true },
  });
  if (!client?.resetTokenHash || !client.resetTokenExp || client.resetTokenExp < new Date()) return { ok: false };
  if (!hashesEqual(sha256(token), client.resetTokenHash)) return { ok: false };
  await db.client.update({ where: { id: client.id }, data: { portalActive: true } });
  return { ok: true, client: { id: client.id, email: client.email, firstName: client.firstName, sessionEpoch: client.sessionEpoch } };
}

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
