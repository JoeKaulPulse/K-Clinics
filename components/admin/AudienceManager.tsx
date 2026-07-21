'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Rules = { gender?: string; source?: string; tag?: string; lapsedDays?: number; optInOnly?: boolean; visited?: string; tier?: string };
export type TierOpt = { key: string; name: string };
export type SegmentRow = { id: string; name: string; description: string; rules: Rules; summary: string; size: number; metaSyncedAt?: string | null };

const field = 'rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm';

async function post(payload: object) {
  const res = await fetch('/api/admin/marketing/segments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json().catch(() => ({ ok: res.ok }));
}

export function AudienceManager({ rows, sources, tags, tiers = [], canManage }: { rows: SegmentRow[]; sources: string[]; tags: string[]; tiers?: TierOpt[]; canManage: boolean }) {
  return (
    <div className="space-y-6">
      {canManage && <Builder sources={sources} tags={tags} tiers={tiers} />}
      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-porcelain)] p-6 text-sm text-[var(--color-stone)]">No segments yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => <Card key={r.id} r={r} canManage={canManage} />)}
        </div>
      )}
    </div>
  );
}

function RuleFields({ rules, setRules, sources, tags, tiers }: { rules: Rules; setRules: (r: Rules) => void; sources: string[]; tags: string[]; tiers: TierOpt[] }) {
  const set = (patch: Partial<Rules>) => setRules({ ...rules, ...patch });
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {tiers.length > 0 && (
        <label className="text-xs text-[var(--color-stone)]">Membership tier
          <select value={rules.tier ?? ''} onChange={(e) => set({ tier: e.target.value || undefined })} className={`${field} w-full`}>
            <option value="">Any</option>{tiers.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </label>
      )}
      <label className="text-xs text-[var(--color-stone)]">Gender
        <select value={rules.gender ?? ''} onChange={(e) => set({ gender: e.target.value || undefined })} className={`${field} w-full`}>
          <option value="">Any</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="NON_BINARY">Non-binary</option>
        </select>
      </label>
      <label className="text-xs text-[var(--color-stone)]">Source
        <select value={rules.source ?? ''} onChange={(e) => set({ source: e.target.value || undefined })} className={`${field} w-full`}>
          <option value="">Any</option>{sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="text-xs text-[var(--color-stone)]">Tag
        <select value={rules.tag ?? ''} onChange={(e) => set({ tag: e.target.value || undefined })} className={`${field} w-full`}>
          <option value="">Any</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="text-xs text-[var(--color-stone)]">Recency
        <select value={rules.visited ?? 'any'} onChange={(e) => set({ visited: e.target.value === 'any' ? undefined : e.target.value, lapsedDays: undefined })} className={`${field} w-full`}>
          <option value="any">Any</option><option value="visited">Has visited</option><option value="never">Never visited</option>
        </select>
      </label>
      <label className="text-xs text-[var(--color-stone)]">Lapsed (days)
        <input type="number" value={rules.lapsedDays ?? ''} onChange={(e) => set({ lapsedDays: e.target.value ? Number(e.target.value) : undefined, visited: undefined })} placeholder="e.g. 180" className={`${field} w-full`} />
      </label>
      <label className="mt-5 flex items-center gap-2 text-xs text-[var(--color-stone)]">
        <input type="checkbox" checked={!!rules.optInOnly} onChange={(e) => set({ optInOnly: e.target.checked })} className="accent-[var(--color-gold)]" /> Marketing opted-in only
      </label>
    </div>
  );
}

function useCount(rules: Rules) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => { const r = await post({ op: 'count', rules }); if (live) setCount(r.ok ? r.count : null); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [rules]);
  return count;
}

function Builder({ sources, tags, tiers }: { sources: string[]; tags: string[]; tiers: TierOpt[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [rules, setRules] = useState<Rules>({});
  const count = useCount(rules);
  async function create() { if (!name.trim()) return; const r = await post({ op: 'create', name, rules }); if (r.ok) { setName(''); setRules({}); router.refresh(); } }
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg">New segment</h2>
        <span className="rounded-full bg-[var(--color-ink)] px-3 py-1 text-xs text-[var(--color-porcelain)]">{count == null ? '…' : `${count} clients`}</span>
      </div>
      <RuleFields rules={rules} setRules={setRules} sources={sources} tags={tags} tiers={tiers} />
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--color-stone)]">Name<br /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lapsed female clients" className={`${field} w-64`} /></label>
        <button onClick={create} className="rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-sm text-[var(--color-porcelain)]">Save segment</button>
      </div>
    </section>
  );
}

function Card({ r, canManage }: { r: SegmentRow; canManage: boolean }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function remove() { if (confirm(`Delete segment “${r.name}”?`)) { await post({ op: 'remove', id: r.id }); router.refresh(); } }
  async function syncMeta() {
    setSyncing(true); setMsg(null);
    const res = await post({ op: 'syncMeta', id: r.id });
    setSyncing(false);
    setMsg(res.ok ? `Uploaded ${res.count ?? 0} opted-in contacts to Meta ✓` : (res.error || 'Sync failed.'));
    if (res.ok) router.refresh();
  }
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-lg">{r.name}</h3>
          <p className="text-xs text-[var(--color-stone)]">{r.summary}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--color-gold)]/15 px-3 py-1 text-sm font-medium text-[var(--color-gold-deep)]">{r.size}</span>
      </div>
      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={syncMeta}
            disabled={syncing}
            title="Uploads this segment's marketing-opted-in clients to Meta as a Custom Audience (for retargeting + lookalikes)."
            className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-bone)] disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : r.metaSyncedAt ? 'Re-sync to Meta' : 'Sync to Meta'}
          </button>
          {r.metaSyncedAt && !msg && <span className="text-xs text-[var(--color-stone)]">Synced {new Date(r.metaSyncedAt).toLocaleDateString('en-GB')}</span>}
          {msg && <span className="min-w-0 text-xs text-[var(--color-stone)]">{msg}</span>}
          <button onClick={remove} className="ml-auto text-xs text-[var(--color-blush-deep)] hover:underline">Delete</button>
        </div>
      )}
    </section>
  );
}
