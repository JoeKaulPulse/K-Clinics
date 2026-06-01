import 'server-only';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { encryptJson, decryptJson } from '@/lib/crypto';
import { generateTotpSecret, verifyTotp, generateRecoveryCodes } from '@/lib/security/totp';

// Two-factor (TOTP) policy + enrolment + verification for staff accounts.
// The secret is stored encrypted at rest (versioned keyring); recovery codes
// are stored bcrypt-hashed and are single-use.

const POLICY_KEY = 'security.require2faRoles';

export async function getRequired2faRoles(): Promise<string[]> {
  const row = await db.setting.findUnique({ where: { key: POLICY_KEY } }).catch(() => null);
  try { const v = row ? JSON.parse(row.value) : []; return Array.isArray(v) ? v : []; } catch { return []; }
}

export async function setRequired2faRoles(roles: string[], updatedBy?: string): Promise<void> {
  const valid = roles.filter((r) => ['OWNER', 'ADMIN', 'PRACTITIONER', 'FRONT_DESK', 'STAFF'].includes(r));
  await db.setting.upsert({ where: { key: POLICY_KEY }, update: { value: JSON.stringify(valid), updatedBy }, create: { key: POLICY_KEY, value: JSON.stringify(valid), updatedBy } });
}

export async function is2faRequiredForRole(role: string): Promise<boolean> {
  return (await getRequired2faRoles()).includes(role);
}

/** Begin enrolment: generate + store a (not-yet-active) secret, return it for QR. */
export async function beginEnrolment(userId: string): Promise<string> {
  const secret = generateTotpSecret();
  await db.adminUser.update({ where: { id: userId }, data: { totpSecret: encryptJson(secret), totpEnabledAt: null } });
  return secret;
}

/** Confirm enrolment with a code from the authenticator; returns recovery codes. */
export async function confirmEnrolment(userId: string, code: string): Promise<{ ok: boolean; recoveryCodes?: string[]; error?: string }> {
  const u = await db.adminUser.findUnique({ where: { id: userId }, select: { totpSecret: true } });
  if (!u?.totpSecret) return { ok: false, error: 'Start setup first.' };
  const secret = decryptJson<string>(u.totpSecret);
  if (!verifyTotp(secret, code)) return { ok: false, error: 'That code didn’t match. Check your authenticator and try again.' };
  const codes = generateRecoveryCodes();
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c.replace('-', ''), 10)));
  await db.adminUser.update({ where: { id: userId }, data: { totpEnabledAt: new Date(), recoveryCodes: hashed } });
  return { ok: true, recoveryCodes: codes };
}

export async function disable2fa(userId: string): Promise<void> {
  await db.adminUser.update({ where: { id: userId }, data: { totpSecret: null, totpEnabledAt: null, recoveryCodes: [] } });
}

type UserWith2fa = { id: string; totpSecret: string | null; totpEnabledAt: Date | null; recoveryCodes: string[] };

/** Verify a second factor (TOTP or a single-use recovery code). Consumes a
 *  recovery code on success. */
export async function verifySecondFactor(user: UserWith2fa, code: string): Promise<{ ok: boolean; usedRecovery?: boolean }> {
  if (!user.totpEnabledAt || !user.totpSecret) return { ok: true }; // 2FA not enabled
  const clean = (code || '').trim();
  if (!clean) return { ok: false };
  // TOTP path
  try {
    const secret = decryptJson<string>(user.totpSecret);
    if (verifyTotp(secret, clean.replace(/\s/g, ''))) return { ok: true };
  } catch { /* fall through */ }
  // Recovery-code path (single-use)
  const candidate = clean.replace(/-/g, '').toUpperCase();
  for (let i = 0; i < user.recoveryCodes.length; i++) {
    if (await bcrypt.compare(candidate, user.recoveryCodes[i])) {
      const remaining = user.recoveryCodes.filter((_, idx) => idx !== i);
      await db.adminUser.update({ where: { id: user.id }, data: { recoveryCodes: remaining } });
      return { ok: true, usedRecovery: true };
    }
  }
  return { ok: false };
}
