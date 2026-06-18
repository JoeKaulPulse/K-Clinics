'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Signed = { id: string; title: string; signedAt: string; declined: boolean; kind: string };
type Pending = { token: string; title: string; kind: string; templateKey: string };
type Template = { key: string; title: string };

export function ConsentPanel({ bookingId, clientId, treatmentForm, templates, signed, pending, baseUrl, canClinical, canManage }: {
  bookingId: string; clientId: string; treatmentForm: { key: string; title: string } | null;
  templates: Template[];
  signed: Signed[]; pending: Pending[]; baseUrl: string; canClinical: boolean; canManage: boolean;
}) {
  const router = useRouter();
  const recommendedKey = treatmentForm?.key ?? null;
  // Always make the recommended form selectable, even if (mis)configured outside
  // the active list, so staff can never get stuck without their expected form.
  const options: Template[] = treatmentForm && !templates.some((t) => t.key === treatmentForm.key)
    ? [{ key: treatmentForm.key, title: treatmentForm.title }, ...templates]
    : templates;
  const defaultKey = recommendedKey ?? options[0]?.key ?? '';
  const pendingForKey = (key: string) => pending.find((p) => p.kind === 'treatment' && p.templateKey === key);

  const [selectedKey, setSelectedKey] = useState(defaultKey);
  const [link, setLink] = useState<string | null>(() => {
    const p = pendingForKey(defaultKey);
    return p ? `${baseUrl}/sign/${p.token}` : null;
  });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const treatmentSigned = signed.find((s) => s.kind === 'treatment');

  // Switching the chosen form shows the existing signing link for that form if one
  // was already created, otherwise resets to the "Create signing link" action.
  function onSelect(key: string) {
    setSelectedKey(key);
    setCopied(false);
    const p = pendingForKey(key);
    setLink(p ? `${baseUrl}/sign/${p.token}` : null);
  }

  async function generate() {
    if (!selectedKey) return;
    setBusy(true);
    const res = await fetch('/api/admin/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'createRequest', clientId, bookingId, templateKey: selectedKey, kind: 'treatment' }) });
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
        ) : !canManage ? (
          // Read-only for clinical staff without booking-management rights.
          treatmentForm ? (
            <p className="text-sm text-[var(--color-stone)]">Client needs to sign: <strong className="text-[var(--color-ink)]">{treatmentForm.title}</strong></p>
          ) : (
            <p className="text-sm text-[var(--color-stone)]">No consent form mapped to this treatment.</p>
          )
        ) : options.length === 0 ? (
          <p className="text-sm text-[var(--color-stone)]">No consent forms are set up yet. Add one under Settings, Consent forms.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="consent-form" className="block text-sm text-[var(--color-stone)]">Consent form for this appointment</label>
              <select
                id="consent-form"
                value={selectedKey}
                onChange={(e) => onSelect(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-gold)]"
              >
                {options.map((t) => (
                  <option key={t.key} value={t.key}>{t.title}{recommendedKey === t.key ? ' (recommended)' : ''}</option>
                ))}
              </select>
              {recommendedKey && selectedKey !== recommendedKey && treatmentForm && (
                <p className="mt-1 text-xs text-[var(--color-stone)]">Recommended for this treatment: <strong className="text-[var(--color-ink)]">{treatmentForm.title}</strong>. You have chosen a different form.</p>
              )}
            </div>
            {link ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">Open to sign on this device</a>
                  <button onClick={copy} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{copied ? 'Copied ✓' : 'Copy phone link'}</button>
                </div>
                <p className="break-all font-mono text-[0.65rem] text-[var(--color-stone)]">{link}</p>
              </div>
            ) : (
              <button onClick={generate} disabled={busy || !selectedKey} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Creating…' : 'Create signing link'}</button>
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
