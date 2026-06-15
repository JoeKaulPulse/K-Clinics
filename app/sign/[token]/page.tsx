import { notFound } from 'next/navigation';
import { crmEnabled } from '@/lib/crm';
import { consentMdToHtml } from '@/lib/consent-md';
import { ConsentSigner } from '@/components/consent/ConsentSigner';
import { KMark, ClinicsWordmark } from '@/components/brand/marks';
import { site } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Trust signal — a consent form asks for a legally-binding medical signature, so
// the page must visibly reassure: branded, secure, encrypted.
function SecureBadge() {
  return (
    <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-3 py-1 text-[0.7rem] font-medium text-[var(--color-stone)]">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      </svg>
      Secure &amp; encrypted
    </span>
  );
}

// A polished terminal-state card (signed / unavailable) — medallion + message,
// matching the signer's own "done" aesthetic.
function StateCard({ tone, title, body }: { tone: 'done' | 'gone'; title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-10 text-center shadow-[var(--shadow-soft)]">
      <span aria-hidden className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${tone === 'done' ? 'bg-[var(--color-gold)] text-white' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>
        {tone === 'done' ? (
          <svg width="24" height="24" viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.8 9 10 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 5v3.5M8 11h.01" /><circle cx="8" cy="8" r="6" /></svg>
        )}
      </span>
      <p className="mt-5 font-[family-name:var(--font-display)] text-2xl">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-stone)]">{body}</p>
    </div>
  );
}

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
    <main className="min-h-dvh bg-[var(--color-bone)]">
      {/* Soft brand wash behind the header so the page feels considered, not bare. */}
      <div className="bg-[radial-gradient(120%_80%_at_50%_-10%,color-mix(in_oklab,var(--color-gold)_12%,transparent)_0%,transparent_60%)]">
        <div className="mx-auto max-w-2xl px-4 pb-2 pt-10 text-center sm:pt-14">
          <span className="inline-flex flex-col items-center text-[var(--color-ink)]">
            <span className="block h-8 w-[1.2rem]"><KMark /></span>
            <span className="mt-2.5 block h-[0.58rem] w-[6.25rem]"><ClinicsWordmark /></span>
          </span>
          <p className="mt-4 font-[family-name:var(--font-display)] text-xl text-[var(--color-ink)]">{reqRow.title}</p>
          <SecureBadge />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
        {done ? (
          <StateCard tone="done" title="Thank you — this form is signed" body="A tamper-evident copy has been securely recorded to your clinic record. You can close this page." />
        ) : expired || !template || !template.active ? (
          <StateCard tone="gone" title="This link is no longer available" body="It may have expired or already been used. Please ask a member of the team for a fresh link." />
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

        <footer className="mt-10 border-t border-[var(--color-line)] pt-6 text-center text-xs leading-relaxed text-[var(--color-stone-soft)]">
          <p className="text-[var(--color-stone)]">{site.name} · {site.address.locality}, {site.address.region}</p>
          <p className="mt-1">Your information is encrypted in transit and at rest. Questions? Call <a href={site.phoneHref} className="underline decoration-[var(--color-line)] underline-offset-2 hover:text-[var(--color-ink)]">{site.phone}</a>.</p>
        </footer>
      </div>
    </main>
  );
}
