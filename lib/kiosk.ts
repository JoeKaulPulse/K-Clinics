import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { analyzeKioskPhoto, analyzeKioskPhotosV2 } from '@/lib/kiosk-ai';
import { createPersonalCode } from '@/lib/promo';
import { site } from '@/lib/site';
import { marketingConsentFields } from '@/lib/consent';
import { clientIp } from '@/lib/security/guard';

// BLD-1351: re-export the hardened last-hop IP resolver (x-vercel-forwarded-for /
// x-real-ip, falling back to the LAST hop of X-Forwarded-For — never the
// client-controllable first hop) so kiosk session limits, share-reward limits
// and funnel logging can't be bypassed by spoofing X-Forwarded-For. Kept as a
// re-export so existing `from '@/lib/kiosk'` call sites need no changes.
export { clientIp };

// ── Shared kiosk helpers ─────────────────────────────────────────────────────
// Token/slug generation, IP hashing (no raw IPs stored), funnel event logging,
// and the fire-and-forget "analyse photo → save result" sequence.

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const SAFE = 'abcdefghijkmnpqrstuvwxyz23456789'; // unambiguous, URL-safe

export const SESSION_TTL = SESSION_TTL_MS;

/** A short, URL-safe, unambiguous token/slug. */
export function randomToken(len = 10): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += SAFE[bytes[i] % SAFE.length];
  return out;
}

/** 8-char share slug. */
export const randomShareSlug = () => randomToken(8);

/** A high-entropy capability secret for a kiosk session (BLD-159). Travels in
 *  the storefront QR (?s=) — physically in-store, not derivable from the short,
 *  brute-forceable token — and is required to read (/stream) or write (/frame)
 *  the live camera feed. 28 chars ≈ 166 bits, far beyond brute force. */
export const randomSecret = () => randomToken(28);

/** Timing-safe compare for the session secret. */
export function secretMatches(expected: string | null | undefined, provided: string | null | undefined): boolean {
  if (!expected) return true; // legacy session minted before BLD-159 — no secret to check
  if (!provided || provided.length !== expected.length) return false;
  try { return timingSafeEqual(Buffer.from(provided), Buffer.from(expected)); } catch { return false; }
}

/** Hash a client IP so we never store the raw address (anti-abuse counting only).
 *  Returns null when the caller has no identifiable IP — every call site treats a
 *  null hash as "unknown device" and skips per-IP counting. */
export function hashIp(ip: string | null | undefined): string | null {
  // BLD-1351: the hardened resolver returns the literal 'unknown' (never null)
  // when no proxy header identifies the caller. That string is not an identity.
  // Hashing it would drop every unidentifiable request into ONE shared bucket —
  // 3 sessions/day and 5/hour site-wide on /api/kiosk/sessions, 20 shares/hour
  // on the reward path — so a single missing header would 429 the in-store
  // kiosk for everyone, and store a fake per-device hash on the session row.
  // Same contract the rest of the security layer already keeps: guard.loginGate
  // excludes 'unknown' from per-IP failure counting and ip-activity never blocks
  // it.
  if (!ip || ip === 'unknown') return null;
  const salt = kioskIpSalt();
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

// BLD-1260: never pseudonymise IPs with a salt that's committed in source (that
// defeats the whole point). Preference order:
//   1. KIOSK_IP_SALT      — the dedicated, explicit secret.
//   2. ENCRYPTION_KEY     — kept for compatibility with the original chain.
//   3. a salt DERIVED from another per-deployment secret (audit
//      07-secrets-integrations.md: "derived from the keyring if desired"). The
//      key itself is never used as the salt — only a domain-separated hash of
//      it — and it is never exposed anywhere. This is what keeps production
//      working: neither KIOSK_IP_SALT nor ENCRYPTION_KEY appears in
//      .env.example, so on today's deployment both are unset and a hard throw
//      here would 500 every public kiosk route (session create, funnel events,
//      result share).
//   4. throw in production — no secret of any kind to derive from.
// Dev/test keeps the literal fallback so local runs need no secrets.
function kioskIpSalt(): string {
  const explicit = process.env.KIOSK_IP_SALT || process.env.ENCRYPTION_KEY;
  if (explicit) return explicit;
  const derivable = process.env.HEALTH_ENCRYPTION_KEY || process.env.ADMIN_JWT_SECRET;
  if (derivable) return createHash('sha256').update(`kiosk-ip-salt:${derivable}`).digest('hex');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('KIOSK_IP_SALT (or ENCRYPTION_KEY / HEALTH_ENCRYPTION_KEY / ADMIN_JWT_SECRET) is required in production for kiosk IP pseudonymisation.');
  }
  // Dev/test-only fallback so the app runs locally without secrets.
  return 'k-clinics-kiosk';
}

/** Log a funnel event. Never throws. */
export async function logKioskEvent(event: string, sessionId?: string | null, ipHash?: string | null): Promise<void> {
  try {
    await db.kioskEvent.create({ data: { event, sessionId: sessionId || null, ipHash: ipHash || null } });
  } catch { /* analytics is best-effort */ }
}

export const sessionExpiry = () => new Date(Date.now() + SESSION_TTL_MS);

/**
 * Fire-and-forget: run the AI analysis for a session's photo and persist a
 * KioskResult, flipping the session to ANALYZED. Safe to call without awaiting;
 * never throws. Logs an `analyzed` event on success.
 */
export async function runKioskAnalysis(sessionId: string): Promise<void> {
  try {
    const session = await db.kioskSession.findUnique({ where: { id: sessionId } });
    if (!session?.photoUrl) return;
    // Don't re-analyse if a result already exists.
    const existing = await db.kioskResult.findUnique({ where: { sessionId } });
    if (existing) return;

    const result = await analyzeKioskPhoto(session.photoUrl);
    if (!result) {
      await db.kioskSession.update({ where: { id: session.id }, data: { status: 'ANALYSIS_FAILED' } }).catch(() => {});
      return;
    }

    await db.kioskResult.create({
      data: {
        sessionId: session.id,
        headline: result.headline,
        skinScore: result.skinScore,
        smileScore: result.smileScore,
        insights: result.insights,
        treatments: result.treatments,
        photoUrl: session.photoUrl,
        shareSlug: randomShareSlug(),
      },
    });
    await db.kioskSession.update({ where: { id: session.id }, data: { status: 'ANALYZED' } });
    await logKioskEvent('analyzed', session.id, session.ipHash);
  } catch (e) {
    console.error('[kiosk] analysis save failed:', (e as Error)?.message);
  }
}

// ── Kiosk v2 analysis (multi-photo, annotations, AI age backstop) ────────────

/** Best-effort delete of kiosk Blob photos. Never throws. */
export async function deleteKioskBlobs(urls: Array<string | null | undefined>): Promise<void> {
  const unique = Array.from(new Set(urls.filter((u): u is string => !!u)));
  if (!unique.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { del } = await import('@vercel/blob');
    await del(unique);
  } catch (e) {
    console.error('[kiosk] blob delete failed:', (e as Error)?.message);
  }
}

/**
 * Fire-and-forget v2 analysis: one multi-photo Sonnet call → KioskResult upsert
 * (annotations/shareCaption/bestPhotoUrl), status ANALYZED, stage 'reveal'.
 * AI challenge-21 backstop: if the model is not confident the visitor is
 * clearly over 21, ALL session photos are purged from Blob, the mirror frame is
 * cleared, and the session becomes AGE_DECLINED / stage 'declined' — no result.
 * Safe to call without awaiting; never throws.
 */
export async function runKioskAnalysisV2(sessionId: string): Promise<void> {
  try {
    const session = await db.kioskSession.findUnique({ where: { id: sessionId } });
    if (!session) return;
    const photos = session.photoUrls?.length
      ? session.photoUrls
      : (session.photoUrl ? [session.photoUrl] : []);
    if (!photos.length) return;

    // Don't double-bill: if this session already analysed, just surface reveal.
    const existing = await db.kioskResult.findUnique({ where: { sessionId }, select: { id: true } });
    if (existing && session.status === 'ANALYZED') {
      await db.kioskSession.update({ where: { id: sessionId }, data: { stage: 'reveal' } }).catch(() => {});
      return;
    }

    const ai = await analyzeKioskPhotosV2(photos);

    if (!ai) {
      await db.kioskSession.update({
        where: { id: sessionId },
        data: { status: 'ANALYSIS_FAILED', stage: 'failed' },
      }).catch(() => {});
      return;
    }

    if (!ai.clearlyOver21) {
      // Inline privacy purge — not cron-dependent. Photos + mirror frame gone now.
      await deleteKioskBlobs([...photos, session.photoUrl]);
      await db.kioskSession.update({
        where: { id: sessionId },
        data: {
          status: 'AGE_DECLINED',
          stage: 'declined',
          photoUrl: null,
          photoUrls: [],
          liveFrame: null,
          liveFrameAt: null,
        },
      }).catch(() => {});
      await logKioskEvent('age_declined', sessionId, session.ipHash);
      return;
    }

    const bestPhotoUrl = photos[ai.bestPhotoIndex] ?? photos[0];
    const insights = ai.observations.map((o) => o.detail).filter(Boolean).slice(0, 6);
    if (!insights.length) insights.push('A naturally photogenic look — the camera agrees');
    // Prisma Json column — observations are plain JSON-safe objects.
    const annotations = JSON.parse(JSON.stringify(ai.observations));

    await db.kioskResult.upsert({
      where: { sessionId },
      create: {
        sessionId,
        headline: ai.headline,
        skinScore: ai.skinScore,
        smileScore: ai.smileScore,
        insights,
        treatments: ai.treatments,
        photoUrl: bestPhotoUrl,
        bestPhotoUrl,
        annotations,
        shareCaption: ai.shareCaption,
        shareSlug: randomShareSlug(),
      },
      update: {
        headline: ai.headline,
        skinScore: ai.skinScore,
        smileScore: ai.smileScore,
        insights,
        treatments: ai.treatments,
        photoUrl: bestPhotoUrl,
        bestPhotoUrl,
        annotations,
        shareCaption: ai.shareCaption,
      },
    });
    await db.kioskSession.update({
      where: { id: sessionId },
      // Mirror frame is no longer needed once we reveal — clear it (privacy).
      data: { status: 'ANALYZED', stage: 'reveal', liveFrame: null, liveFrameAt: null },
    });
    await logKioskEvent('analyzed', sessionId, session.ipHash);
  } catch (e) {
    console.error('[kiosk] v2 analysis save failed:', (e as Error)?.message);
    Sentry.captureException(e, { tags: { area: 'kiosk-ai-v2' } });
    await db.kioskSession.update({
      where: { id: sessionId },
      data: { status: 'ANALYSIS_FAILED', stage: 'failed' },
    }).catch(() => {});
  }
}

// ── Share-to-claim reward ────────────────────────────────────────────────────
const OOH_CAMPAIGN_SLUG = 'skin-smile-ooh';

/** Idempotently ensure the "Storefront Skin & Smile (OOH)" marketing campaign
 *  exists (so kiosk discount codes attribute against it). Returns its id. */
export async function getOohCampaignId(): Promise<string> {
  const c = await db.marketingCampaign.upsert({
    where: { slug: OOH_CAMPAIGN_SLUG },
    update: {},
    create: { slug: OOH_CAMPAIGN_SLUG, name: 'Storefront Skin & Smile (OOH)', status: 'ACTIVE', goal: 'leads', description: 'In-store QR kiosk: AI skin & smile score → social share → account + share-to-claim discount.' },
    select: { id: true },
  });
  return c.id;
}

export type ClaimResult = { ok: true; code: string; pct: number; days: number } | { ok: false; error: string };

// BLD-1644: transient marker while a claim is between "reserved" and "code
// minted" — never a real discount code, never returned to a caller.
const CLAIM_PENDING = '__PENDING__';

/** Issue the share-to-claim discount: requires the session to have been SHARED,
 *  creates/links a client (marketing opt-in per the visitor's explicit tick —
 *  BLD-1420), mints a single-use campaign code, emails it, and records it on
 *  the result. Idempotent per result. */
export async function claimKioskDiscount(resultId: string, emailRaw: string, firstNameRaw: string, marketingOptIn = false): Promise<ClaimResult> {
  const email = (emailRaw || '').trim().toLowerCase();
  const firstName = (firstNameRaw || '').trim().slice(0, 60);
  if (!/\S+@\S+\.\S+/.test(email)) return { ok: false, error: 'Enter a valid email.' };
  if (!firstName) return { ok: false, error: 'Enter your first name.' };

  const { getSetting, getConfigNumber } = await import('@/lib/settings');
  if (!(await getSetting('kiosk_discount_enabled'))) return { ok: false, error: 'Rewards are paused right now — please ask in clinic.' };

  const result = await db.kioskResult.findUnique({ where: { id: resultId }, include: { session: { select: { id: true, status: true, ipHash: true, ageDeclaredAt: true } } } });
  if (!result) return { ok: false, error: 'Result not found.' };
  // Idempotent: if already claimed, return the existing code.
  if (result.claimCode && result.claimCode !== CLAIM_PENDING) return { ok: true, code: result.claimCode, pct: await getConfigNumber('kiosk_discount_pct'), days: await getConfigNumber('kiosk_discount_days') };
  // Share-gate.
  if (result.session.status !== 'SHARED') return { ok: false, error: 'Share your score first to unlock your reward 🎁' };

  // BLD-1644: reserve the claim atomically before minting a code. The read
  // above and the write below used to be two separate steps, so two
  // concurrent POSTs for the same result could both pass the "not claimed
  // yet" check and each mint a single-use code. Only the request whose
  // updateMany actually flips claimCode from null to CLAIM_PENDING proceeds;
  // the loser is told to retry (by then the winner's real code has landed).
  const reserved = await db.kioskResult.updateMany({ where: { id: resultId, claimCode: null }, data: { claimCode: CLAIM_PENDING, claimEmail: email, claimedAt: new Date() } });
  if (reserved.count !== 1) return { ok: false, error: 'Claiming your reward — please try again in a moment.' };

  const pct = Math.max(1, Math.min(100, await getConfigNumber('kiosk_discount_pct')));
  const days = Math.max(1, await getConfigNumber('kiosk_discount_days'));
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // Find or create the client. The kiosk's explicit 18+ tap carries over to the
  // client record so later bookings inherit the declaration (attribution per
  // KIOSK_V2_CONTRACT.md).
  const ageDeclaredAt = result.session.ageDeclaredAt;
  // BLD-892: the claim email is typed at the kiosk and unverified, so it must
  // NEVER flip an EXISTING client's marketing preference — someone entering
  // another person's address (or one that previously opted out) can't fabricate
  // consent for them. A brand-new client is created with WHATEVER the visitor's
  // own explicit checkbox said (BLD-1420: off by default, same pattern as
  // EnquiryForm/GiftVoucherFlow — no more passive-text implied opt-in); an
  // existing record keeps its own preference and we refresh consent evidence
  // (BLD-128, GDPR Art. 7) only when it is already opted in. The age
  // declaration carries over to the record either way. The upsert stays atomic
  // against a concurrent create.
  const existingClient = await db.client.findUnique({ where: { email }, select: { marketingOptIn: true } });
  const kioskUpdate: Record<string, unknown> = {};
  if (existingClient?.marketingOptIn) Object.assign(kioskUpdate, marketingConsentFields('kiosk'));
  if (ageDeclaredAt) kioskUpdate.ageDeclaredAt = ageDeclaredAt;
  try {
    await db.client.upsert({
      where: { email },
      update: kioskUpdate,
      create: { email, firstName, marketingOptIn, source: 'kiosk', ...(marketingOptIn ? marketingConsentFields('kiosk') : {}), ...(ageDeclaredAt ? { ageDeclaredAt } : {}) },
    });
  } catch (e) { console.error('[kiosk] client upsert failed (continuing):', (e as Error)?.message); }

  let code: string;
  try {
    code = await createPersonalCode({ campaignId: await getOohCampaignId(), email, discountType: 'PERCENT', percent: pct, expiresAt, label: 'Storefront Skin & Smile (OOH)' });
  } catch (e) {
    // Release the reservation so a retry can mint a fresh code instead of
    // being stuck behind a permanent CLAIM_PENDING with nothing to show for it.
    await db.kioskResult.update({ where: { id: resultId }, data: { claimCode: null, claimEmail: null, claimedAt: null } }).catch(() => {});
    return { ok: false, error: (e as Error)?.message || 'Could not issue your code — please try again.' };
  }

  await db.kioskResult.update({ where: { id: resultId }, data: { claimCode: code } }).catch(() => {});
  await logKioskEvent('claimed', result.session.id, result.session.ipHash);

  // Email the code (best-effort).
  try {
    const { sendEmail, tmplKioskReward } = await import('@/lib/email');
    const base = (process.env.NEXT_PUBLIC_SITE_URL || site.url).replace(/\/$/, '');
    await sendEmail({ to: email, subject: `Your ${pct}% KClinics reward — code ${code}`, html: tmplKioskReward({ firstName, code, pct, days, bookUrl: `${base}/book` }) });
  } catch (e) { console.error('[kiosk] reward email failed (continuing):', (e as Error)?.message); }

  return { ok: true, code, pct, days };
}
