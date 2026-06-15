import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionPermissions, sessionCan } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';
import { CrmDisabled } from '@/components/admin/CrmDisabled';
import { ConsultationNotes } from '@/components/admin/ConsultationNotes';
import { StatusSelect } from '@/components/admin/ClientActions';

export const dynamic = 'force-dynamic';

// Clean up HTML entities in imported consultation text (display-only, safe).
function tidyConsultText(s: string): string {
  return s
    .replace(/&#0*47;/g, '/')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(Number(n)); } catch { return _; } })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
    .trim();
}

export default async function ConsultationDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) return <CrmDisabled />;
  const { id } = await params;
  const { getConsultation } = await import('@/lib/crm-data');
  const session = await getSession();
  if (!sessionCan(session, 'consultations.view')) redirect('/admin');

  const consult = await getConsultation(id);
  if (!consult) notFound();

  const clinical = sessionCan(session, 'clients.clinical.view');
  const can = await sessionPermissions();
  const fullName = [consult.client.firstName, consult.client.lastName].filter(Boolean).join(' ');

  const notes = consult.notes.map((n) => ({
    id: n.id,
    body: n.body,
    author: n.author,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <AdminShell user={session?.email} can={can}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/admin/consultations" className="text-[var(--color-gold)] hover:underline">← Consultations</Link>
        <span className="text-[var(--color-stone-soft)]">·</span>
        <Link href={`/admin/clients/${consult.clientId}`} className="text-[var(--color-gold)] hover:underline">{fullName}</Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{fullName}</h1>
          <p className="mt-1 text-sm capitalize text-[var(--color-stone)]">
            {consult.category} consultation · {new Date(consult.createdAt).toLocaleDateString('en-GB')}
          </p>
        </div>
        <StatusSelect consultId={consult.id} clientId={consult.clientId} current={consult.status} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {/* Team notes with @-mentions — staff only */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-xl">Team notes</h2>
              <span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--color-stone)]">
                Staff only
              </span>
            </div>
            <ConsultationNotes consultationId={consult.id} initial={notes} />
          </section>

          {/* Client's original message */}
          {consult.message && (
            <section>
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Client message</h2>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
                <p className="whitespace-pre-wrap text-sm">{tidyConsultText(consult.message)}</p>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-lg">Details</h2>
            <dl className="space-y-2 text-sm">
              {consult.treatments.length > 0 && (
                <div className="grid grid-cols-[1fr_1.5fr] gap-2 border-b border-[var(--color-line)] pb-2">
                  <dt className="text-[var(--color-stone-soft)]">Treatments</dt>
                  <dd className="font-medium">{consult.treatments.join(', ')}</dd>
                </div>
              )}
              {consult.concerns && (
                <div className="grid grid-cols-[1fr_1.5fr] gap-2 border-b border-[var(--color-line)] pb-2">
                  <dt className="text-[var(--color-stone-soft)]">Concerns</dt>
                  <dd>{consult.concerns}</dd>
                </div>
              )}
              {consult.preferredTime && (
                <div className="grid grid-cols-[1fr_1.5fr] gap-2 border-b border-[var(--color-line)] pb-2">
                  <dt className="text-[var(--color-stone-soft)]">Preferred time</dt>
                  <dd className="capitalize">{consult.preferredTime}</dd>
                </div>
              )}
              {consult.preferredContact && (
                <div className="grid grid-cols-[1fr_1.5fr] gap-2 border-b border-[var(--color-line)] pb-2">
                  <dt className="text-[var(--color-stone-soft)]">Contact method</dt>
                  <dd className="capitalize">{consult.preferredContact}</dd>
                </div>
              )}
              {consult.assignedTo && (
                <div className="grid grid-cols-[1fr_1.5fr] gap-2 border-b border-[var(--color-line)] pb-2">
                  <dt className="text-[var(--color-stone-soft)]">Assigned to</dt>
                  <dd>{consult.assignedTo}</dd>
                </div>
              )}
              {consult.medicalNotes && clinical && (
                <div className="grid grid-cols-[1fr_1.5fr] gap-2">
                  <dt className="text-[var(--color-stone-soft)]">Medical notes</dt>
                  <dd>{consult.medicalNotes}</dd>
                </div>
              )}
            </dl>
          </div>

          <Link
            href={`/admin/clients/${consult.clientId}`}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 text-sm hover:bg-[var(--color-bone)]"
          >
            <div>
              <p className="font-medium">{fullName}</p>
              <p className="text-xs text-[var(--color-stone)]">{consult.client.email}</p>
            </div>
            <span className="text-xs text-[var(--color-gold)]">Client record →</span>
          </Link>
        </aside>
      </div>
    </AdminShell>
  );
}
