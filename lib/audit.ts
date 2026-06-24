import 'server-only';
import { db } from '@/lib/db';
import type { AuditAction } from '@prisma/client';

/**
 * Append-only audit log. Records every meaningful action across the
 * booking → treatment → payment lifecycle. Never updated or deleted.
 */
export async function logAudit(opts: {
  action: AuditAction;
  actor: string; // staff email, 'client', or 'system'
  actorRole?: string;
  summary: string;
  bookingId?: string | null;
  clientId?: string | null;
  enrolmentId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await db.auditEvent.create({
      data: {
        action: opts.action,
        actor: opts.actor,
        actorRole: opts.actorRole,
        summary: opts.summary,
        bookingId: opts.bookingId ?? null,
        clientId: opts.clientId ?? null,
        enrolmentId: opts.enrolmentId ?? null,
        meta: opts.meta ? (opts.meta as object) : undefined,
      },
    });
  } catch (e) {
    // BLD-394: auditing must never break the primary action, but silent swallowing
    // hides compliance gaps. Log so monitoring/Sentry surfaces it.
    console.error('[audit] write failed — compliance gap:', (e as Error)?.message, { action: opts.action, actor: opts.actor });
  }
}

/** Full audit trail for a booking, oldest first. */
export async function bookingAuditTrail(bookingId: string) {
  return db.auditEvent.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });
}

/** Recent activity across the clinic (for an admin activity feed). */
export async function recentAudit(limit = 50) {
  return db.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}
