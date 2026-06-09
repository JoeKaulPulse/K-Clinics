import 'server-only';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { unlockCookie, verifyUnlock, signUnlock } from '@/lib/webauthn';

// A second factor in front of financial data (reports, cashflow, finance KPIs):
// a 6-digit PIN (and, via the shared step-up, a passkey). Unlock mints a short-
// lived 'finance' token stored in a per-purpose cookie (see lib/webauthn).

const COOKIE = unlockCookie('finance');

export async function hasFinancePin(sub: string): Promise<boolean> {
  const u = await db.adminUser.findUnique({ where: { id: sub }, select: { financePinHash: true } });
  return !!u?.financePinHash;
}

export async function setFinancePin(sub: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: 'Choose a 6-digit PIN.' };
  if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') return { ok: false, error: 'That PIN is too easy to guess — choose another.' };
  await db.adminUser.update({ where: { id: sub }, data: { financePinHash: await bcrypt.hash(pin, 11) } });
  return { ok: true };
}

export async function verifyFinancePin(sub: string, pin: string): Promise<boolean> {
  const u = await db.adminUser.findUnique({ where: { id: sub }, select: { financePinHash: true } });
  if (!u?.financePinHash) return false;
  return bcrypt.compare((pin || '').trim(), u.financePinHash);
}

/** Mint + set the 30-min finance unlock cookie for this user. */
export async function grantFinanceUnlock(sub: string): Promise<void> {
  const token = await signUnlock(sub, 'finance');
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 60 });
}

/** Is the current request holding a valid finance unlock for this user? */
export async function financeUnlocked(sub: string): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  return verifyUnlock(token, sub, 'finance');
}
