'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Provider = { id: string; name: string; category: string; blurb: string; state: 'connected' | 'ready' | 'setup'; setupSteps: string[]; docsUrl: string; redirectUri: string };

const BADGE: Record<string, string> = {
  connected: 'bg-green-100 text-green-800',
  ready: 'bg-blue-100 text-blue-800',
  setup: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
};
const LABEL: Record<string, string> = { connected: 'Connected', ready: 'Ready to connect', setup: 'Setup required' };

// Native platform dashboards, surfaced once connected for quick ROI verification.
const DASHBOARD: Record<string, string> = {
  google: 'https://ads.google.com/aw/overview',
  meta: 'https://adsmanager.facebook.com/',
  tiktok: 'https://ads.tiktok.com/i18n/dashboard',
};

export function ConnectionsManager({ providers, flash }: { providers: Provider[]; flash: { connected?: string; error?: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);

  async function disconnect(id: string) {
    if (!confirm('Disconnect this platform?')) return;
    await fetch('/api/admin/marketing/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'disconnect', provider: id }) });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {flash.connected && <p className="rounded-[var(--radius-sm)] bg-[var(--color-jade)]/12 px-4 py-3 text-sm text-[var(--color-jade)]">Connected {flash.connected} ✓</p>}
      {flash.error && <p className="rounded-[var(--radius-sm)] bg-[var(--color-blush)]/20 px-4 py-3 text-sm text-[var(--color-ink)]">Couldn’t complete that connection ({flash.error.replace(/_/g, ' ')}). Check the setup steps and try again.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((p) => (
          <section key={p.id} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg">{p.name}</h2>
                <p className="text-xs uppercase tracking-wide text-[var(--color-stone-soft)]">{p.category}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.65rem] font-medium ${BADGE[p.state]}`}>{LABEL[p.state]}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--color-stone)]">{p.blurb}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {p.state === 'connected' ? (
                <>
                  {DASHBOARD[p.id] && <a href={DASHBOARD[p.id]} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">View in {p.name.split(' ')[0]} ↗</a>}
                  <button onClick={() => disconnect(p.id)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-blush)]">Disconnect</button>
                </>
              ) : p.state === 'ready' ? (
                <a href={`/api/admin/marketing/connect?provider=${p.id}`} className="rounded-full bg-[var(--color-ink)] px-5 py-1.5 text-sm text-[var(--color-porcelain)]">Connect</a>
              ) : (
                <button onClick={() => setOpen(open === p.id ? null : p.id)} className="rounded-full border border-[var(--color-line)] px-4 py-1.5 text-sm hover:border-[var(--color-gold)]">{open === p.id ? 'Hide setup' : 'Setup guide'}</button>
              )}
              <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-gold)] hover:underline">Developer console ↗</a>
            </div>

            {(open === p.id || (p.state === 'setup' && open === p.id)) && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4">
                <ol className="ml-4 list-decimal space-y-1.5 text-sm text-[var(--color-stone)]">
                  {p.setupSteps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
                <div className="mt-3">
                  <p className="text-xs font-medium text-[var(--color-ink)]">Redirect URI</p>
                  <code className="mt-1 block break-all rounded bg-[var(--color-bone)] px-2 py-1 text-[0.7rem]">{p.redirectUri}</code>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
