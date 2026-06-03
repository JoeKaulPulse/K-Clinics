import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { consentMdToHtml } from '@/lib/consent-md';
import { ConsentSigner } from '@/components/consent/ConsentSigner';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  if (!crmEnabled) notFound();
  const { token } = await params;
  const { db } = await import('@/lib/db');
  const reqRow = await db.consentRequest.findUnique({ where: { token } });
  if (!reqRow) notFound();

  const template = await db.consentTemplate.findUnique({ where: { key: reqRow.templateKey } });
  const client = await db.client.findUnique({ where: { id: reqRow.clientId }, select: { firstName: true, lastName: true } });
  const fullName = [client?.firstName, client?.lastName].filter(Boolean).join(' ');

  const done = reqRow.status === 'SIGNED';
  const expired = reqRow.status === 'EXPIRED' || (reqRow.expiresAt && reqRow.expiresAt < new Date());

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[var(--color-bone)] px-4 py-8">
      <div className="mb-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{site.name}</p>
        <p className="text-sm text-[var(--color-stone)]">{reqRow.title}</p>
      </div>

      {done ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl">Thank you — this form is signed ✓</p>
          <p className="mt-2 text-sm text-[var(--color-stone)]">A copy has been securely recorded. You can close this page.</p>
        </div>
      ) : expired || !template || !template.active ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl">This link is no longer available</p>
          <p className="mt-2 text-sm text-[var(--color-stone)]">Please ask a member of the team for a new link.</p>
        </div>
      ) : (
        <ConsentSigner
          token={token}
          title={template.title}
          bodyHtml={consentMdToHtml(template.bodyMd)}
          acknowledgements={template.acknowledgements}
          defaultName={fullName}
          kind={reqRow.kind}
        />
      )}
    </main>
  );
}
