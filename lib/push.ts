import 'server-only';
import webpush from 'web-push';
import { db } from '@/lib/db';

// Web-push (Phase 4). Ships dark: every function no-ops until a VAPID keypair is
// set (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional VAPID_SUBJECT). Generate one
// with `npx web-push generate-vapid-keys` and set them in Vercel.

let configured = false;
function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@kclinics.co.uk', pub, priv);
    configured = true;
  }
  return true;
}

export const pushConfigured = (): boolean => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const vapidPublicKey = (): string | null => process.env.VAPID_PUBLIC_KEY || null;

/** Send a push to every device a user has enabled. Prunes subscriptions the push
 *  service reports as gone (404/410). Best-effort. */
export async function sendPush(userId: string, payload: { title: string; body?: string | null; href?: string | null; tag?: string }): Promise<void> {
  if (!ensureVapid()) return;
  const subs = await db.pushSubscription.findMany({ where: { userId } }).catch(() => []);
  if (!subs.length) return;
  const data = JSON.stringify({ title: payload.title, body: payload.body || '', href: payload.href || '/admin', tag: payload.tag });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
    }
  }));
}
