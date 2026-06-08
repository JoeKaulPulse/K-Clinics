'use client';

import { useCallback, useEffect, useState } from 'react';

type Ev = { id: string; kind: string; body: string | null; actor: string; createdAt: string };
type Item = {
  id: string; type: string; title: string; detail: string | null; status: string; urgency: string;
  assignee: string; reportedBy: string | null; pageUrl: string | null; screenshots: string[];
  blocker: string | null; githubUrl: string | null; createdAt: string; updatedAt: string; events: Ev[];
};

const COLUMNS: { key: string; label: string }[] = [
  { key: 'TRIAGE', label: 'Triage' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'IN_REVIEW', label: 'In review' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'SHIPPED', label: 'Shipped' },
];
const URGENCY: Record<string, { label: string; cls: string }> = {
  P0: { label: 'P0 · Critical', cls: 'bg-red-100 text-red-800' },
  P1: { label: 'P1 · High', cls: 'bg-amber-100 text-amber-800' },
  P2: { label: 'P2 · Normal', cls: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
  P3: { label: 'P3 · Low', cls: 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]' },
};
const TYPES = ['ERROR', 'TASK', 'IDEA', 'REVIEW', 'AUDIT'];
const post = (p: object) => fetch('/api/admin/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).then((r) => r.json()).catch(() => ({ ok: false }));
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function BuildBoard({ canManage, github, staff }: { canManage: boolean; github: boolean; staff: { email: string; name: string | null }[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [gh, setGh] = useState<{ connected: boolean; repo: string | null }>({ connected: github, repo: null });
  const [ghForm, setGhForm] = useState({ repo: 'JoeKaulPulse/K-Clinics', token: '', busy: false, error: '' });

  const load = useCallback(async (force = false) => {
    if (!force && typeof document !== 'undefined' && document.hidden) return; // pause when backgrounded
    const res = await fetch('/api/admin/build').then((x) => x.json()).catch(() => ({ ok: false }));
    if (res.ok) { setItems(res.items); setGh({ connected: !!res.github, repo: res.githubRepo || null }); }
    setLoading(false);
  }, []);

  async function connectGh() {
    if (!ghForm.repo.trim() || !ghForm.token.trim()) { setGhForm((f) => ({ ...f, error: 'Enter the repo and a token.' })); return; }
    setGhForm((f) => ({ ...f, busy: true, error: '' }));
    const r = await post({ op: 'github-connect', repo: ghForm.repo.trim(), token: ghForm.token.trim() });
    setGhForm((f) => ({ ...f, busy: false, error: r.ok ? '' : (r.error || 'Could not connect.'), token: r.ok ? '' : f.token }));
    if (r.ok) { if (r.warning) alert(r.warning); load(true); }
  }
  async function disconnectGh() {
    if (!window.confirm('Disconnect GitHub? Logged items will stop creating issues.')) return;
    const r = await post({ op: 'github-disconnect' });
    if (r.ok) load(true);
  }
  useEffect(() => { load(true); const t = setInterval(() => load(), 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (active) setActive(items.find((i) => i.id === active.id) || null); }, [items]); // keep modal fresh

  async function patch(id: string, body: object) { const r = await post({ op: 'update', id, ...body }); if (r.ok) load(); else alert(r.error || 'Failed'); }

  const counts = (k: string) => items.filter((i) => i.status === k).length;
  const open = items.filter((i) => !['SHIPPED', 'CANCELLED'].includes(i.status)).length;
  const blocked = items.filter((i) => i.status === 'BLOCKED').length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-[var(--color-stone)]">
        <span><strong className="text-[var(--color-ink)]">{open}</strong> open</span>
        <span><strong className="text-[var(--color-ink)]">{blocked}</strong> blocked</span>
        <span><strong className="text-[var(--color-ink)]">{items.filter((i) => i.assignee === 'claude' && !['SHIPPED', 'CANCELLED'].includes(i.status)).length}</strong> with Claude</span>
        {gh.connected ? <span className="text-[var(--color-jade)]">GitHub connected ✓{gh.repo ? ` · ${gh.repo}` : ''}</span> : <span className="text-[var(--color-stone-soft)]">GitHub not connected</span>}
        {canManage && gh.connected && <button onClick={disconnectGh} className="text-xs text-[var(--color-blush)] hover:underline">Disconnect</button>}
      </div>

      {/* Connect GitHub (self-serve; no env vars needed) */}
      {canManage && !gh.connected && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Connect GitHub</h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Link a repo so items can be pushed to GitHub issues (and P0/P1 auto-create one). Create a fine-grained token scoped to this repo with <strong>Metadata: Read</strong> + <strong>Issues: Read &amp; write</strong>, then paste it below — it’s stored encrypted. (Pasting a full GitHub URL works too.)</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-stone)]">Repository<br /><input value={ghForm.repo} onChange={(e) => setGhForm((f) => ({ ...f, repo: e.target.value }))} placeholder="owner/name" className="mt-1 w-56 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" /></label>
            <label className="text-xs text-[var(--color-stone)]">Access token<br /><input type="password" value={ghForm.token} onChange={(e) => setGhForm((f) => ({ ...f, token: e.target.value }))} placeholder="github_pat_… / ghp_…" className="mt-1 w-64 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" /></label>
            <button onClick={connectGh} disabled={ghForm.busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{ghForm.busy ? 'Connecting…' : 'Connect & test'}</button>
          </div>
          {ghForm.error && <p className="mt-2 text-sm text-[var(--color-blush)]">{ghForm.error}</p>}
          <p className="mt-2 text-xs text-[var(--color-stone-soft)]">The token is validated against the repo before saving. You can also set GITHUB_TOKEN + GITHUB_REPO in the environment instead.</p>
        </div>
      )}

      {loading && items.length === 0 ? <p className="text-sm text-[var(--color-stone-soft)]">Loading…</p> : (
        <div className="grid gap-4 lg:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col.key} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
              <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">{col.label}<span className="text-[var(--color-stone-soft)]">{counts(col.key)}</span></p>
              <div className="space-y-2">
                {items.filter((i) => i.status === col.key).map((i) => (
                  <button key={i.id} onClick={() => setActive(i)} className="block w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3 text-left hover:border-[var(--color-gold)]">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${URGENCY[i.urgency]?.cls}`}>{i.urgency}</span>
                      <span className="text-[0.6rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{i.type}</span>
                    </div>
                    <p className="text-sm font-medium leading-snug">{i.title}</p>
                    <p className="mt-1 flex items-center gap-2 text-[0.65rem] text-[var(--color-stone)]">
                      <span>{i.assignee === 'claude' ? '◆ Claude' : i.assignee.split('@')[0]}</span>
                      {i.screenshots.length > 0 && <span>· 📎{i.screenshots.length}</span>}
                      {i.githubUrl && <span>· GH</span>}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(42,36,32,0.5)] p-4" onClick={() => setActive(null)}>
          <div className="my-8 w-full max-w-2xl rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${URGENCY[active.urgency]?.cls}`}>{URGENCY[active.urgency]?.label}</span>
                  <span className="text-[0.65rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{active.type}</span>
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-xl">{active.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--color-stone)]">Reported by {active.reportedBy || '—'} · {fmt(active.createdAt)}{active.pageUrl ? ` · ${active.pageUrl}` : ''}</p>
              </div>
              <button onClick={() => setActive(null)} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
            </div>

            {active.detail && <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">{active.detail}</p>}
            {active.screenshots.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {active.screenshots.map((s) => <a key={s} href={s} target="_blank" rel="noreferrer"><img src={s} alt="" className="h-24 w-auto rounded border border-[var(--color-line)]" /></a>)}
              </div>
            )}

            {canManage && (
              <div className="mt-4 flex flex-wrap items-end gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 p-3 text-xs">
                <label>Status<br /><select value={active.status} onChange={(e) => patch(active.id, { status: e.target.value })} className="mt-1 rounded border border-[var(--color-line)] bg-white px-2 py-1">{[...COLUMNS.map((c) => c.key), 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                <label>Urgency<br /><select value={active.urgency} onChange={(e) => patch(active.id, { urgency: e.target.value })} className="mt-1 rounded border border-[var(--color-line)] bg-white px-2 py-1">{Object.keys(URGENCY).map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
                <label>Assignee<br /><select value={active.assignee} onChange={(e) => patch(active.id, { assignee: e.target.value })} className="mt-1 rounded border border-[var(--color-line)] bg-white px-2 py-1"><option value="claude">Claude</option>{staff.map((s) => <option key={s.email} value={s.email}>{s.name || s.email}</option>)}</select></label>
                {gh.connected && !active.githubUrl && <button onClick={async () => { const r = await post({ op: 'github', id: active.id }); if (r.ok) load(); else alert(r.error); }} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:bg-white">Push to GitHub</button>}
                {active.githubUrl && <a href={active.githubUrl} target="_blank" rel="noreferrer" className="text-[var(--color-gold-deep)] underline">View GitHub issue ↗</a>}
              </div>
            )}

            {/* Audit / comments */}
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Activity</h3>
            <ul className="mt-2 space-y-1.5 border-l border-[var(--color-line)] pl-3 text-xs text-[var(--color-stone)]">
              {active.events.map((e) => (
                <li key={e.id}><span className="text-[var(--color-ink-soft)]">{e.kind === 'comment' ? '' : `${e.kind}: `}{e.body}</span> <span className="text-[var(--color-stone-soft)]">— {e.actor === 'claude' ? 'Claude' : e.actor.split('@')[0]}, {fmt(e.createdAt)}</span></li>
              ))}
            </ul>
            <CommentBox id={active.id} onDone={load} />
          </div>
        </div>
      )}
    </>
  );
}

function CommentBox({ id, onDone }: { id: string; onDone: () => void }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add a note…" className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
      <button disabled={busy || !v.trim()} onClick={async () => { setBusy(true); const r = await post({ op: 'comment', id, body: v }); setBusy(false); if (r.ok) { setV(''); onDone(); } }} className="rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">Note</button>
    </div>
  );
}
