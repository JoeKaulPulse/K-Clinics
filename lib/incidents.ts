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
};

/** Every incident in the clinic, newest first — including erasure-retained
 *  (clientId: null) rows. Optionally narrowed by severity and/or RIDDOR flag. */
export async function listIncidentRegister(filter?: { severity?: string; riddorOnly?: boolean }): Promise<IncidentRegisterRow[]> {
  const where: { severity?: string; riddorReportable?: boolean } = {};
  if (filter?.severity) where.severity = filter.severity;
  if (filter?.riddorOnly) where.riddorReportable = true;

  const rows = await db.incident.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { client: { select: { id: true, firstName: true, lastName: true } } },
  });

  return rows.map((r) => {
    let detail: { description?: string; injury?: string; actionTaken?: string; witnesses?: string } = {};
    try { detail = JSON.parse(decClinical(r.descriptionEnc) || '{}'); } catch { /* leave blank if undecryptable */ }
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
    };
  });
}
