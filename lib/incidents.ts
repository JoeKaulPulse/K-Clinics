import 'server-only';
import { db } from '@/lib/db';
import { decClinical } from '@/lib/clinical-crypto';

// PRJ-1229.4 — clinic-wide incident (accident/adverse-reaction) register.
//
// Incident.client is `onDelete: SetNull` (not Cascade — see prisma/schema.prisma
// around the Incident model) so a RIDDOR-reportable record outlives a client's
// GDPR erasure, kept under Art. 17(3)(b)'s legal-retention exception. Before this
// helper, the only read path was `GET /api/admin/incidents?clientId=...`
// (app/api/admin/incidents/route.ts), which requires a clientId — once erasure
// sets Incident.clientId to null, that path can never surface the row again.
// This is the clinic-wide read path: every incident, including clientId-null
// ones, newest first.

export type IncidentRegisterRow = {
  id: string;
  bookingId: string | null;
  clientId: string | null;
  clientName: string | null;
  category: string;
  severity: string;
  location: string | null;
  riddorReportable: boolean;
  loggedBy: string | null;
  createdAt: string;
  description: string;
  injury: string;
  actionTaken: string;
  witnesses: string;
  // Why the four detail fields above are blank, when they are. Blank detail has
  // two very different meanings on a safety register and they must not look the
  // same to the person reading it:
  //   redacted      — the narrative was deliberately overwritten when the client
  //                   was erased or deleted (app/admin/actions.ts writes
  //                   { redacted: 'client-erased' | 'client-deleted' }). The
  //                   record is intact and complete as retained.
  //   decryptFailed — the ciphertext did not decrypt (wrong/rotated clinical
  //                   key, corrupt row). The record is NOT intact and someone
  //                   needs to know.
  redacted: string | null;
  decryptFailed: boolean;
};

/** Most incidents we will read in one go. A safety register that silently stops
 *  at a round number is worse than one that says it stopped, so the caller is
 *  told the true total and can say so (see `total` on the result). */
export const INCIDENT_REGISTER_LIMIT = 500;

export type IncidentRegisterResult = {
  rows: IncidentRegisterRow[];
  /** Total matching the filter, ignoring the limit. `total > rows.length` means
   *  the register is showing only the most recent INCIDENT_REGISTER_LIMIT. */
  total: number;
};

/** Every incident in the clinic, newest first — including erasure-retained
 *  (clientId: null) rows. Optionally narrowed by severity and/or RIDDOR flag. */
export async function listIncidentRegister(filter?: { severity?: string; riddorOnly?: boolean }): Promise<IncidentRegisterResult> {
  const where: { severity?: string; riddorReportable?: boolean } = {};
  if (filter?.severity) where.severity = filter.severity;
  if (filter?.riddorOnly) where.riddorReportable = true;

  const [rows, total] = await Promise.all([
    db.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: INCIDENT_REGISTER_LIMIT,
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
    }),
    db.incident.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((r) => {
      let detail: { description?: string; injury?: string; actionTaken?: string; witnesses?: string; redacted?: string } = {};
      let decryptFailed = false;
      try {
        detail = JSON.parse(decClinical(r.descriptionEnc) || '{}');
      } catch {
        // Leave the detail blank, but remember WHY — see the type above.
        decryptFailed = true;
      }
      return {
        id: r.id,
        bookingId: r.bookingId,
        clientId: r.clientId,
        clientName: r.client ? [r.client.firstName, r.client.lastName].filter(Boolean).join(' ') : null,
        category: r.category,
        severity: r.severity,
        location: r.location,
        riddorReportable: r.riddorReportable,
        loggedBy: r.loggedBy,
        createdAt: r.createdAt.toISOString(),
        description: detail.description || '',
        injury: detail.injury || '',
        actionTaken: detail.actionTaken || '',
        witnesses: detail.witnesses || '',
        redacted: typeof detail.redacted === 'string' ? detail.redacted : null,
        decryptFailed,
      };
    }),
  };
}
