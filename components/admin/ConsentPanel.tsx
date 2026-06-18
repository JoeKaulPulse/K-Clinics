'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Signed = { id: string; title: string; signedAt: string; declined: boolean; kind: string };
type Pending = { token: string; title: string; kind: string };

export function ConsentPanel({ bookingId, clientId, treatmentForm, signed, pending, baseUrl, canClinical, canManage }: {
  bookingId: string; clientId: string; treatmentForm: { key: string; title: string } | null;
  signed: Signed[]; pending: Pending[]; baseUrl: string; canClinical: boolean; canManage: boolean;
}) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(pending.find((p) => p.kind === 'treatment')?.token ? `${baseUrl}/sign/${pending.find((p) => p.kind === 'treatment')!.token}` : null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const treatmentSigned = signed.find((s) => s.kind === 'treatment');

  async function generate() {
    if (!treatmentForm) return;
    setBusy(true);
    const res = await fetch('/api/admin/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'createRequest', clientId, bookingId, templateKey: treatmentForm.key, kind: 'treatment' }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) { setLink(j.url); router.refresh(); }
  }
  function copy() { if (link) { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1200); } }

  return (
    <div>
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">Consent</h2>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
        {treatmentSigned ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm"><span className="text-[var(--color-jade)]">✓ Signed</span> · {treatmentSigned.title} <span className="text-xs text-[var(--color-stone)]">· {new Date(treatmentSigned.signedAt).toLocaleString('en-GB')}</span></p>
            {canClinical && <Link href={`/admin/consent/cert/${treatmentSigned.id}`} className="shrink-0 text-xs text-[var(--color-gold)] hover:underline">Certificate →</Link>}
          </div>
        ) : !treatmentForm ? (
          <p className="text-sm text-[var(--color-stone)]">No consent form mapped to this treatment.</p>
        ) : (
          <div>
            <p className="text-sm text-[var(--color-stone)]">Client needs to sign: <strong className="text-[var(--color-ink)]">{treatmentForm.title}</strong></p>
            {canManage && (
              <div className="mt-3">
                {link ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">Open to sign on this device</a>
                      <button onClick={copy} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{copied ? 'Copied ✓' : 'Copy phone link'}</button>
                    </div>
                    <p className="break-all font-mono text-[0.65rem] text-[var(--color-stone)]">{link}</p>
                  </div>
                ) : (
                  <button onClick={generate} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Creating…' : 'Create signing link'}</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Any other signed forms (e.g. photo opt-out) */}
        {signed.filter((s) => s.kind !== 'treatment').map((s) => (
          <div key={s.id} className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--color-line)] pt-2">
            <p className="text-sm">{s.declined ? '⚠ ' : '✓ '}{s.title} <span className="text-xs text-[var(--color-stone)]">· {new Date(s.signedAt).toLocaleString('en-GB')}</span></p>
            {canClinical && <Link href={`/admin/consent/cert/${s.id}`} className="shrink-0 text-xs text-[var(--color-gold)] hover:underline">Certificate →</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
