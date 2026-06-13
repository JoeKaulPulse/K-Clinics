'use server';

import { revalidatePath } from 'next/cache';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { isKioskThemeKey } from '@/lib/kiosk-themes';

// BLD-137 — set the active kiosk seasonal scene theme (requires settings.manage).
export async function setKioskTheme(key: string): Promise<{ ok: boolean; error?: string }> {
  if (!crmEnabled) return { ok: false, error: 'Unavailable.' };
  const session = await getSession();
  if (!session || !sessionCan(session, 'settings.manage')) return { ok: false, error: 'Not permitted.' };
  if (!isKioskThemeKey(key)) return { ok: false, error: 'Unknown theme.' };
  const { setStringSetting } = await import('@/lib/settings');
  await setStringSetting('kiosk_theme', key, session.email);
  revalidatePath('/admin/qr');
  revalidatePath('/kiosk/display');
  return { ok: true };
}
