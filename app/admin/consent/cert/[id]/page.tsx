import { notFound, redirect } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { getSession, sessionCan } from '@/lib/auth';
import { consentMdToHtml } from '@/lib/consent-md';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  if (!crmEnabled) notFound();
  const session = await getSession();
  if (!sessionCan(session, 'clients.clinical.view')) redirect('/admin');
  const { id } = await params;

  const { db } = await import('@/lib/db');
  const rec = await db.signedConsent.findUnique({ where: { id } });
  if (!rec) notFound();

  const { decryptJson, verifyIntegrity } = await import('@/lib/crypto');
  let data: { bodyMd: string; acknowledgements: { label: string; checked: boolean }[]; signatureDataUrl: string; signerName: string; signedAt: string; openedAt: string | null; ip: string | null; userAgent: string | null; contentHash: string } | null = null;
  let tamper = false;
  try {
    data = decryptJson(rec.cipher);
    tamper = !verifyIntegrity(rec.cipher, { clientId: rec.clientId, templateKey: rec.templateKey, contentHash: rec.contentHash }, rec.integrityHash);
  } catch { tamper = true; }

  const client = await db.client.findUnique({ where: { id: rec.clientId }, select: { firstName: true, lastName: true, email: true } });
  const dt = (s?: string | Date | null) => (s ? new Date(s).toLocaleString('en-GB') : '—');

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <a href="javascript:history.back()" className="text-sm text-[var(--color-stone)] hover:underline">← Back</a>
        <button onClick={undefined} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm" style={{ cursor: 'pointer' }} data-print>Print / save PDF</button>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8">
        <div className="mb-6 border-b border-[var(--color-line)] pb-4 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl">{site.name}</p>
          <p className="text-sm text-[var(--color-stone)]">Certificate of {rec.declined ? 'declined photo consent' : 'consent'}</p>
        </div>

        {tamper && <p className="mb-4 rounded bg-red-100 px-3 py-2 text-sm font-medium text-red-800">⚠ Integrity check failed — this record may have been tampered with.</p>}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Form" value={`${rec.title} (v${rec.templateVersion})`} />
          <Field label="Status" value={rec.declined ? 'Declined (opt-out)' : 'Signed'} />
          <Field label="Client" value={[client?.firstName, client?.lastName].filter(Boolean).join(' ') || '—'} />
          <Field label="Email" value={client?.email ?? '—'} />
          <Field label="Signed by" value={data?.signerName ?? rec.signerName} />
          <Field label="Signed at" value={dt(rec.signedAt)} />
          <Field label="Opened at" value={dt(data?.openedAt)} />
          <Field label="IP address" value={rec.ip ?? '—'} />
          <Field label="Certificate ID" value={rec.contentHash} mono full />
        </dl>

        {data && (
          <>
            <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)] p-4 text-sm leading-relaxed [&_blockquote]:hidden [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2" dangerouslySetInnerHTML={{ __html: consentMdToHtml(data.bodyMd) }} />
            <ul className="mt-4 space-y-1 text-sm">
              {data.acknowledgements.map((a, i) => <li key={i}>{a.checked ? '☑' : '☐'} {a.label}</li>)}
            </ul>
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide text-[var(--color-stone)]">Signature</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.signatureDataUrl} alt="Signature" className="mt-1 h-28 rounded border border-[var(--color-line)] bg-white" />
            </div>
          </>
        )}
        <p className="mt-6 text-center text-[0.7rem] text-[var(--color-stone)]">This is an immutable record held under the clinic’s encrypted Health Data store. Any alteration invalidates the certificate ID above.</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: "document.querySelector('[data-print]')?.addEventListener('click',()=>window.print())" }} />
    </main>
  );
}

function Field({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <dt className="text-[0.65rem] uppercase tracking-wide text-[var(--color-stone)]">{label}</dt>
      <dd className={`text-[var(--color-ink)] ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
