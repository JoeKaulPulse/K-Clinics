import 'server-only';
import { db as sharedDb } from '@/lib/db';
import type { PrismaClient } from '@prisma/client';

// ClinicOS Ring 2 — injectable database seam for the Academy domain (BLD-303).
//
// Today the Academy code shares the one process-wide PrismaClient (lib/db.ts),
// already tenant-scoped by the `$extends` query hook. This module gives that
// dependency an explicit, swappable seam: Academy modules import the client from
// here instead of reaching straight into lib/db, so a later Ring can point the
// Academy domain at a different connection — or a separate service — by injecting
// an alternative client at init, with NO change to any call site.
//
// Default behaviour is identical: `academyDb` forwards to the shared client
// until `setAcademyDb()` is called, so this is a pure no-op refactor today.

let current: PrismaClient = sharedDb;

/** Inject the Prisma client the Academy domain should use (e.g. a dedicated
 *  connection, a read-replica, or a test double). Call once at init/bootstrap. */
export function setAcademyDb(client: PrismaClient): void {
  current = client;
}

/** Restore the shared client (used by tests after injecting a double). */
export function resetAcademyDb(): void {
  current = sharedDb;
}

/** The Academy Prisma client. A Proxy (rather than a bound reference) so every
 *  import site always sees the currently-injected client without re-importing —
 *  the seam can be swapped at runtime. Model delegates (`.course`, `.lesson`…)
 *  are returned as-is; top-level client methods (`$transaction`, `$queryRaw`…)
 *  are bound to the live client so `this` is correct. */
export const academyDb: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const value = Reflect.get(current as object, prop);
    return typeof value === 'function' ? value.bind(current) : value;
  },
});
