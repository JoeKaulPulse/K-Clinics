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
        meta: opts.meta ? (opts.meta as object) : undefined,
      },
    });
  } catch (err) {
    // Auditing must never break the primary action, but failures must be visible.
    console.error('[audit] auditEvent.create failed:', (err as Error)?.message);
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
