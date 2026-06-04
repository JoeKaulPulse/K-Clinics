'use client';

import { useState } from 'react';

// Full-database backup/export. The download itself is OWNER-gated server-side;
// this card is only rendered for owners.
export function DataExportCard() {
  const [busy, setBusy] = useState(false);

  function download() {
    if (!confirm('Download a full backup of ALL clinic data (clients, bookings, forms, finance, content — everything)?\n\nThis file contains sensitive personal and clinical data. Store it securely.')) return;
    setBusy(true);
    // A normal navigation triggers the browser download; reset shortly after.
    window.location.href = '/api/admin/export';
    setTimeout(() => setBusy(false), 4000);
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-6">
      <h2 className="font-[family-name:var(--font-display)] text-xl">Data export &amp; backup</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-stone)]">
        Download a complete, restorable snapshot of every record in the system — clients, bookings, consultations,
        health &amp; consent forms, finance, loyalty, gift cards, campaigns, content and more. Use this for regular
        backups or to migrate to a new environment. Data loss insurance: keep a recent copy somewhere safe.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--color-stone-soft)]">
        <li>Restores into a PostgreSQL database built from the same schema.</li>
        <li>Encrypted fields export as ciphertext — migrate the encryption keys (env vars) too.</li>
        <li>Uploaded media live in Vercel Blob; this export includes their URLs — copy the Blob store separately.</li>
        <li>The file holds sensitive personal &amp; clinical data — store it encrypted and access-controlled.</li>
      </ul>
      <button onClick={download} disabled={busy} className="mt-5 rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm text-[var(--color-porcelain)] disabled:opacity-60">
        {busy ? 'Preparing…' : 'Download full backup (.json)'}
      </button>
    </section>
  );
}
