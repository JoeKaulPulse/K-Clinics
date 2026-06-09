'use client';

import { useCallback, useEffect, useState } from 'react';

type Ev = { id: string; kind: string; body: string | null; actor: string; createdAt: string };
type Subtask = { id: string; title: string; status: string; assignee: string; ownerInput: boolean; order: number; completedAt: string | null; completedBy: string | null };
type Item = {
  id: string; type: string; title: string; detail: string | null; status: string; urgency: string;
  assignee: string; reportedBy: string | null; pageUrl: string | null; screenshots: string[];
  blocker: string | null; githubUrl: string | null; createdAt: string; updatedAt: string;
  value: number | null; effort: number | null; startedAt: string | null; estCompleteAt: string | null;
  estTokens: number | null; actualTokens: number | null; shippedAt: string | null; closedAt: string | null; closedBy: string | null;
  events: Ev[]; subtasks: Subtask[];
};
type Activity = { events: { id: string; kind: string; body: string | null; title: string; itemId: string; createdAt: string }[]; inProgress: { id: string; title: string }[]; continueRequestedAt: string | null };

const COLUMNS: { key: string; label: string }[] = [
  { key: 'TRIAGE', label: 'Triage' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'IN_REVIEW', label: 'In review' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'CLOSED', label: 'Closed' },
];
const ALL_STATUSES = [...COLUMNS.map((c) => c.key), 'CANCELLED'];
const URGENCY: Record<string, { label: string; cls: string }> = {
  P0: { label: 'P0 · Critical', cls: 'bg-red-100 text-red-800' },
  P1: { label: 'P1 · High', cls: 'bg-amber-100 text-amber-800' },
  P2: { label: 'P2 · Normal', cls: 'bg-[var(--color-bone)] text-[var(--color-stone)]' },
  P3: { label: 'P3 · Low', cls: 'bg-[var(--color-bone)] text-[var(--color-stone-soft)]' },
};
const post = (p: object) => fetch('/api/admin/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).then((r) => r.json()).catch(() => ({ ok: false }));
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const ve = (i: Item) => (i.value && i.effort ? Math.round((i.value / i.effort) * 100) / 100 : null);
function durMs(i: Item): number | null {
  if (!i.startedAt) return null;
  const end = i.closedAt || i.shippedAt || new Date().toISOString();
  return Math.max(0, +new Date(end) - +new Date(i.startedAt));
}
function fmtDur(ms: number): string {
  const h = ms / 3.6e6;
  if (h < 1) return `${Math.max(1, Math.round(ms / 6e4))}m`;
  if (h < 48) return `${Math.round(h * 10) / 10}h`;
  return `${Math.round((h / 24) * 10) / 10}d`;
}
const tokenStr = (n: number | null) => (n ? (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)) : '—');

export function BuildBoard({ canManage, isAdmin, github, staff, me }: { canManage: boolean; isAdmin: boolean; github: boolean; staff: { email: string; name: string | null }[]; me: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [gh, setGh] = useState<{ connected: boolean; repo: string | null }>({ connected: github, repo: null });
  const [ghForm, setGhForm] = useState({ repo: 'JoeKaulPulse/K-Clinics', token: '', busy: false, error: '' });
  const [sync, setSync] = useState<{ inSync: boolean; dbCount: number; backlogCount: number; lastSeededAt: string | null; commit: string } | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [mirror, setMirror] = useState(false);
  const [backoffUntil, setBackoffUntil] = useState(0);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'kanban' | 'list' | 'timeline'>('kanban');
  const [mine, setMine] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!force && typeof document !== 'undefined' && document.hidden) return;
    const res = await fetch('/api/admin/build').then((x) => x.json()).catch(() => ({ ok: false }));
    if (res.ok) { setItems(res.items); setGh({ connected: !!res.github, repo: res.githubRepo || null }); setSync(res.sync || null); setActivity(res.activity || null); setMirror(!!res.mirror); setBackoffUntil(res.backoffUntil || 0); }
    setLoading(false);
  }, []);

  useEffect(() => { load(true); const t = setInterval(() => load(), 20000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (active) setActive(items.find((i) => i.id === active.id) || null); }, [items]); // keep modal fresh

  async function patch(id: string, body: object) { const r = await post({ op: 'update', id, ...body }); if (r.ok) load(); else alert(r.error || 'Failed'); }

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
  const [syncing, setSyncing] = useState(false);
  async function syncAll() {
    setSyncing(true);
    const r = await post({ op: 'github-sync-all' });
    setSyncing(false);
    if (r.ok && r.backoff) alert('GitHub is cooling down after heavy use — sync paused automatically. Everything stays on the board; try again later.');
    else if (r.ok) { alert(r.remaining > 0 ? `Synced ${r.synced} to GitHub · ${r.remaining} remaining — click again in a moment.` : `All synced to GitHub ✓ (${r.synced} this round).`); load(true); }
    else alert(r.error || 'Sync failed.');
  }
  const [seeding, setSeeding] = useState(false);
  async function importBacklog() {
    setSeeding(true);
    const r = await post({ op: 'seed-backlog' });
    setSeeding(false);
    if (r.ok) { alert(`Rebuilt from backlog — ${r.created} added, ${r.reconciled || 0} status update(s)${r.skipped ? `, ${r.skipped} already present` : ''}.`); load(true); }
    else alert(r.error || 'Rebuild failed.');
  }
  async function toggleMirror() {
    const r = await post({ op: 'mirror', on: !mirror });
    if (r.ok) { setMirror(!!r.mirror); load(true); } else alert(r.error || 'Failed');
  }
  const [continuing, setContinuing] = useState(false);
  async function continueWork() {
    setContinuing(true);
    const r = await post({ op: 'continue' });
    setContinuing(false);
    alert(r.note || (r.ok ? 'Saved to Claude’s work queue.' : (r.error || 'Could not request.')));
    load(true);
  }

  const ql = q.trim().toLowerCase();
  const view2 = items
    .filter((i) => (mine ? i.assignee === me : true))
    .filter((i) => (ql ? `${i.title} ${i.detail || ''} ${i.assignee} ${i.urgency} ${i.type}`.toLowerCase().includes(ql) : true));
  const counts = (k: string) => view2.filter((i) => i.status === k).length;
  const open = items.filter((i) => !['SHIPPED', 'CLOSED', 'CANCELLED'].includes(i.status)).length;
  const blocked = items.filter((i) => i.status === 'BLOCKED').length;
  const awaitingSignoff = items.filter((i) => i.status === 'SHIPPED').length;

  return (
    <>
      <style>{`@keyframes kcTicker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>

      {/* Live activity ticker */}
      <ActivityTicker activity={activity} />

      <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-[var(--color-stone)]">
        <span><strong className="text-[var(--color-ink)]">{open}</strong> open</span>
        <span><strong className="text-[var(--color-ink)]">{blocked}</strong> blocked</span>
        <span><strong className="text-[var(--color-ink)]">{awaitingSignoff}</strong> awaiting sign-off</span>
        <span><strong className="text-[var(--color-ink)]">{items.filter((i) => i.assignee === 'claude' && !['SHIPPED', 'CLOSED', 'CANCELLED'].includes(i.status)).length}</strong> with Claude</span>
        {gh.connected ? <span className="text-[var(--color-jade)]">GitHub ✓{gh.repo ? ` · ${gh.repo}` : ''}</span> : <span className="text-[var(--color-stone-soft)]">GitHub not connected</span>}
        {gh.connected && canManage && <button onClick={toggleMirror} title="When off, the board never auto-pushes to GitHub — it runs entirely on its own and won’t hit API limits. Turn on to also mirror items to issues." className={`rounded-full px-2 py-0.5 text-xs ${mirror ? 'bg-[var(--color-jade)]/15 text-[var(--color-jade)]' : 'bg-[var(--color-bone)] text-[var(--color-stone)]'}`}>mirror {mirror ? 'on' : 'off'}</button>}
        {backoffUntil > Date.now() && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800" title="GitHub rate-limited; auto-pushes paused. The board is unaffected.">GitHub cooling down · {new Date(backoffUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {canManage && <button onClick={continueWork} disabled={continuing} className="rounded-full bg-[var(--color-gold)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-ink)] disabled:opacity-50">{continuing ? 'Prompting…' : '▶ Continue working'}</button>}
          <button onClick={() => setIdeaOpen(true)} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs hover:bg-[var(--color-bone)]">💡 Add idea</button>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-gold)]" /> Mine</label>
          {canManage && <button onClick={importBacklog} disabled={seeding} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:bg-[var(--color-bone)] disabled:opacity-50">{seeding ? 'Rebuilding…' : '↻ Rebuild'}</button>}
        </span>
      </div>

      {/* Search + view switcher + sync state */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks (incl. shipped & closed)…" className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
        <div className="flex rounded-full border border-[var(--color-line)] bg-white p-0.5 text-xs">
          {(['kanban', 'list', 'timeline'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 capitalize ${view === v ? 'bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'text-[var(--color-stone)]'}`}>{v}</button>
          ))}
        </div>
        {canManage && gh.connected && items.some((i) => !i.githubUrl) && <button onClick={syncAll} disabled={syncing} className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs hover:bg-[var(--color-bone)] disabled:opacity-50">{syncing ? 'Syncing…' : `⤴ Sync ${items.filter((i) => !i.githubUrl).length} to GitHub`}</button>}
        {sync && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${sync.inSync ? 'bg-[var(--color-bone)] text-[var(--color-stone)]' : 'bg-amber-100 text-amber-800'}`} title={`Live build: ${sync.commit}`}>
            <span className={`h-2 w-2 rounded-full ${sync.inSync ? 'bg-[var(--color-jade)]' : 'bg-amber-500'}`} />
            {sync.inSync ? 'In sync' : 'Behind'} · {sync.dbCount}/{sync.backlogCount} · {sync.commit}
          </span>
        )}
      </div>

      {/* Connect GitHub (self-serve) */}
      {canManage && !gh.connected && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Connect GitHub</h2>
          <p className="mt-1 text-sm text-[var(--color-stone)]">Link a repo so items push to issues, P0/P1 auto-create one, and the “Continue working” button can wake Claude. Use a fine-grained token with <strong>Metadata: Read</strong> + <strong>Issues: Read &amp; write</strong>.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-[var(--color-stone)]">Repository<br /><input value={ghForm.repo} onChange={(e) => setGhForm((f) => ({ ...f, repo: e.target.value }))} placeholder="owner/name" className="mt-1 w-56 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" /></label>
            <label className="text-xs text-[var(--color-stone)]">Access token<br /><input type="password" value={ghForm.token} onChange={(e) => setGhForm((f) => ({ ...f, token: e.target.value }))} placeholder="github_pat_… / ghp_…" className="mt-1 w-64 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" /></label>
            <button onClick={connectGh} disabled={ghForm.busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{ghForm.busy ? 'Connecting…' : 'Connect & test'}</button>
            {canManage && gh.connected && <button onClick={disconnectGh} className="text-xs text-[var(--color-blush)] hover:underline">Disconnect</button>}
          </div>
          {ghForm.error && <p className="mt-2 text-sm text-[var(--color-blush)]">{ghForm.error}</p>}
        </div>
      )}

      {loading && items.length === 0 ? <p className="text-sm text-[var(--color-stone-soft)]">Loading…</p> : (
        <>
          {view === 'kanban' && <KanbanView columns={COLUMNS} items={view2} counts={counts} onOpen={setActive} />}
          {view === 'list' && <ListView items={view2} onOpen={setActive} />}
          {view === 'timeline' && <TimelineView items={view2} onOpen={setActive} />}
        </>
      )}

      {active && <TaskModal item={active} canManage={canManage} isAdmin={isAdmin} gh={gh} staff={staff} onClose={() => setActive(null)} onChange={load} patch={patch} />}
      {ideaOpen && <IdeaModal onClose={() => setIdeaOpen(false)} onDone={load} />}
    </>
  );
}

// ── Activity ticker ──────────────────────────────────────────────────────────
function ActivityTicker({ activity }: { activity: Activity | null }) {
  if (!activity || (activity.events.length === 0 && activity.inProgress.length === 0)) return null;
  const icon = (k: string) => (k === 'shipped' || k === 'closed' ? '✅' : k === 'status' ? '→' : k === 'comment' ? '💬' : k === 'github' ? '🔗' : k === 'subtask' ? '☑' : '•');
  const chips = [
    ...activity.inProgress.map((p) => `🛠 Working on: ${p.title}`),
    ...activity.events.map((e) => `${icon(e.kind)} ${e.title}${e.body ? ` — ${e.body}` : ''}`),
  ];
  if (!chips.length) return null;
  const doubled = [...chips, ...chips]; // seamless loop
  return (
    <div className="mb-4 overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-ink)] py-2 text-xs text-[var(--color-porcelain)]">
      <div className="flex w-max gap-8 whitespace-nowrap pl-4" style={{ animation: 'kcTicker 60s linear infinite' }}>
        {doubled.map((c, i) => <span key={i} className="opacity-90">{c}</span>)}
      </div>
    </div>
  );
}

// ── Views ────────────────────────────────────────────────────────────────────
function Card({ i, onOpen }: { i: Item; onOpen: (i: Item) => void }) {
  const done = i.subtasks.filter((s) => s.status === 'DONE').length;
  const r = ve(i);
  const d = durMs(i);
  return (
    <button onClick={() => onOpen(i)} className="block w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3 text-left hover:border-[var(--color-gold)]">
      <div className="mb-1 flex items-center gap-1.5">
        <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${URGENCY[i.urgency]?.cls}`}>{i.urgency}</span>
        <span className="text-[0.6rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{i.type}</span>
        {r != null && <span className="ml-auto text-[0.6rem] text-[var(--color-stone-soft)]">V:E {r}</span>}
      </div>
      <p className="text-sm font-medium leading-snug">{i.title}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.65rem] text-[var(--color-stone)]">
        <span>{i.assignee === 'claude' ? '◆ Claude' : i.assignee.split('@')[0]}</span>
        {i.subtasks.length > 0 && <span>· ☑ {done}/{i.subtasks.length}</span>}
        {d != null && <span>· ⏱ {fmtDur(d)}</span>}
        {i.screenshots.length > 0 && <span>· 📎{i.screenshots.length}</span>}
        {i.githubUrl && <span>· GH</span>}
        {i.status === 'CLOSED' && <span className="text-[var(--color-jade)]">· ✓ closed</span>}
      </p>
    </button>
  );
}

function KanbanView({ columns, items, counts, onOpen }: { columns: { key: string; label: string }[]; items: Item[]; counts: (k: string) => number; onOpen: (i: Item) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {columns.map((col) => (
        <div key={col.key} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-3">
          <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">{col.label}<span className="text-[var(--color-stone-soft)]">{counts(col.key)}</span></p>
          <div className="space-y-2">
            {items.filter((i) => i.status === col.key).map((i) => <Card key={i.id} i={i} onOpen={onOpen} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  const sorted = [...items].sort((a, b) => ALL_STATUSES.indexOf(a.status) - ALL_STATUSES.indexOf(b.status) || a.urgency.localeCompare(b.urgency));
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-[var(--color-porcelain)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
          <tr>{['Task', 'Type', 'Urgency', 'Status', 'Owner', 'V:E', 'Subtasks', 'Time', 'ETA'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {sorted.map((i) => {
            const done = i.subtasks.filter((s) => s.status === 'DONE').length; const d = durMs(i); const r = ve(i);
            return (
              <tr key={i.id} onClick={() => onOpen(i)} className="cursor-pointer border-t border-[var(--color-line)] bg-white hover:bg-[var(--color-bone)]">
                <td className="px-3 py-2 font-medium">{i.title}</td>
                <td className="px-3 py-2 text-xs text-[var(--color-stone)]">{i.type}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${URGENCY[i.urgency]?.cls}`}>{i.urgency}</span></td>
                <td className="px-3 py-2 text-xs">{i.status.replace('_', ' ').toLowerCase()}</td>
                <td className="px-3 py-2 text-xs">{i.assignee === 'claude' ? '◆ Claude' : i.assignee.split('@')[0]}</td>
                <td className="px-3 py-2 text-xs">{r ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{i.subtasks.length ? `${done}/${i.subtasks.length}` : '—'}</td>
                <td className="px-3 py-2 text-xs">{d != null ? fmtDur(d) : '—'}</td>
                <td className="px-3 py-2 text-xs">{i.estCompleteAt ? day(i.estCompleteAt) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TimelineView({ items, onOpen }: { items: Item[]; onOpen: (i: Item) => void }) {
  const rows = [...items].filter((i) => i.status !== 'CANCELLED').sort((a, b) => +new Date(a.startedAt || a.createdAt) - +new Date(b.startedAt || b.createdAt));
  if (!rows.length) return <p className="text-sm text-[var(--color-stone-soft)]">No items to plot.</p>;
  const starts = rows.map((i) => +new Date(i.startedAt || i.createdAt));
  const ends = rows.map((i) => +new Date(i.closedAt || i.shippedAt || i.estCompleteAt || new Date().toISOString()));
  const min = Math.min(...starts), max = Math.max(...ends, Date.now());
  const span = Math.max(1, max - min);
  const pct = (t: number) => `${((t - min) / span) * 100}%`;
  const barColor = (s: string) => (s === 'CLOSED' ? 'var(--color-jade)' : s === 'SHIPPED' ? 'var(--color-gold)' : s === 'BLOCKED' ? 'var(--color-blush)' : 'var(--color-stone)');
  return (
    <div className="space-y-1.5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
      <div className="mb-2 flex justify-between text-[0.65rem] text-[var(--color-stone-soft)]"><span>{day(new Date(min).toISOString())}</span><span>{day(new Date(max).toISOString())}</span></div>
      {rows.map((i) => {
        const s = +new Date(i.startedAt || i.createdAt); const e = +new Date(i.closedAt || i.shippedAt || i.estCompleteAt || new Date().toISOString());
        return (
          <button key={i.id} onClick={() => onOpen(i)} className="group block w-full">
            <div className="relative h-6 w-full rounded-full bg-white">
              <div className="absolute top-0 flex h-6 items-center rounded-full px-2 text-[0.6rem] text-white" style={{ left: pct(s), width: `max(8%, ${((e - s) / span) * 100}%)`, background: barColor(i.status) }}>
                <span className="truncate">{i.title}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Task detail modal ────────────────────────────────────────────────────────
function TaskModal({ item, canManage, isAdmin, gh, staff, onClose, onChange, patch }: {
  item: Item; canManage: boolean; isAdmin: boolean; gh: { connected: boolean; repo: string | null };
  staff: { email: string; name: string | null }[]; onClose: () => void; onChange: () => void; patch: (id: string, body: object) => void;
}) {
  const d = durMs(item);
  const closed = item.status === 'CLOSED';
  const done = item.subtasks.filter((s) => s.status === 'DONE').length;

  // Telemetry editor (managers): value/effort/ETA/tokens saved together.
  const [tel, setTel] = useState({ value: item.value ?? '', effort: item.effort ?? '', estCompleteAt: item.estCompleteAt ? item.estCompleteAt.slice(0, 10) : '', actualTokens: item.actualTokens ?? '' });
  const [telBusy, setTelBusy] = useState(false);
  async function saveTel() {
    setTelBusy(true);
    await patch(item.id, {
      value: tel.value === '' ? null : Number(tel.value), effort: tel.effort === '' ? null : Number(tel.effort),
      estCompleteAt: tel.estCompleteAt || null, actualTokens: tel.actualTokens === '' ? null : Number(tel.actualTokens),
    });
    setTelBusy(false);
  }

  // Subtasks
  const [stTitle, setStTitle] = useState('');
  const [stOwner, setStOwner] = useState(false);
  const [stBusy, setStBusy] = useState(false);
  async function addSub() {
    if (!stTitle.trim()) return;
    setStBusy(true);
    const r = await post({ op: 'subtask-add', id: item.id, title: stTitle.trim(), ownerInput: stOwner });
    setStBusy(false);
    if (r.ok) { setStTitle(''); setStOwner(false); onChange(); } else alert(r.error || 'Could not add subtask.');
  }
  async function setSubStatus(subId: string, status: string) { const r = await post({ op: 'subtask-update', subtaskId: subId, status }); if (r.ok) onChange(); else alert(r.error || 'Failed'); }

  async function signoff() { if (!confirm('Sign off and close this task? This marks the work reviewed & complete.')) return; const r = await post({ op: 'signoff', id: item.id }); if (r.ok) onChange(); else alert(r.error || 'Failed'); }
  async function reopen() { const reason = prompt('Reopen this task — add a note for Claude (what still needs doing):') || undefined; const r = await post({ op: 'reopen', id: item.id, reason }); if (r.ok) onChange(); else alert(r.error || 'Failed'); }

  const lbl = 'text-[0.6rem] uppercase tracking-wide text-[var(--color-stone-soft)]';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(42,36,32,0.5)] p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${URGENCY[item.urgency]?.cls}`}>{URGENCY[item.urgency]?.label}</span>
              <span className="text-[0.65rem] uppercase tracking-wide text-[var(--color-stone-soft)]">{item.type}</span>
              {closed && <span className="rounded-full bg-[var(--color-jade)]/15 px-2 py-0.5 text-[0.65rem] font-medium text-[var(--color-jade)]">Closed ✓</span>}
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-xl">{item.title}</h2>
            <p className="mt-0.5 text-xs text-[var(--color-stone)]">Reported by {item.reportedBy || '—'} · {fmt(item.createdAt)}{item.pageUrl ? ` · ${item.pageUrl}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-sm text-[var(--color-stone)] hover:text-[var(--color-ink)]">✕</button>
        </div>

        {item.detail && <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">{item.detail}</p>}
        {item.screenshots.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">{item.screenshots.map((s) => <a key={s} href={s} target="_blank" rel="noreferrer"><img src={s} alt="" className="h-24 w-auto rounded border border-[var(--color-line)]" /></a>)}</div>
        )}

        {/* Telemetry strip */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3 text-xs sm:grid-cols-4">
          <div><p className={lbl}>Value:Effort</p><p className="mt-0.5">{ve(item) ?? '—'}{item.value && item.effort ? <span className="text-[var(--color-stone-soft)]"> ({item.value}/{item.effort})</span> : ''}</p></div>
          <div><p className={lbl}>Time spent</p><p className="mt-0.5">{d != null ? fmtDur(d) : '—'}</p></div>
          <div><p className={lbl}>ETA</p><p className="mt-0.5">{item.estCompleteAt ? day(item.estCompleteAt) : '—'}</p></div>
          <div><p className={lbl}>Tokens</p><p className="mt-0.5">{tokenStr(item.actualTokens)}{item.estTokens ? <span className="text-[var(--color-stone-soft)]"> / ~{tokenStr(item.estTokens)}</span> : ''}</p></div>
        </div>

        {canManage && (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-bone)]/50 p-3 text-xs">
            <label>Status<br /><select value={item.status} onChange={(e) => patch(item.id, { status: e.target.value })} className="mt-1 rounded border border-[var(--color-line)] bg-white px-2 py-1">{ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label>Urgency<br /><select value={item.urgency} onChange={(e) => patch(item.id, { urgency: e.target.value })} className="mt-1 rounded border border-[var(--color-line)] bg-white px-2 py-1">{Object.keys(URGENCY).map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
            <label>Assignee<br /><select value={item.assignee} onChange={(e) => patch(item.id, { assignee: e.target.value })} className="mt-1 rounded border border-[var(--color-line)] bg-white px-2 py-1"><option value="claude">Claude</option>{staff.map((s) => <option key={s.email} value={s.email}>{s.name || s.email}</option>)}</select></label>
            <label>Value<br /><input value={tel.value} onChange={(e) => setTel((t) => ({ ...t, value: e.target.value.replace(/\D/g, '').slice(0, 2) }))} className="mt-1 w-12 rounded border border-[var(--color-line)] bg-white px-2 py-1" /></label>
            <label>Effort<br /><input value={tel.effort} onChange={(e) => setTel((t) => ({ ...t, effort: e.target.value.replace(/\D/g, '').slice(0, 2) }))} className="mt-1 w-12 rounded border border-[var(--color-line)] bg-white px-2 py-1" /></label>
            <label>ETA<br /><input type="date" value={tel.estCompleteAt} onChange={(e) => setTel((t) => ({ ...t, estCompleteAt: e.target.value }))} className="mt-1 rounded border border-[var(--color-line)] bg-white px-2 py-1" /></label>
            <label>Tokens<br /><input value={tel.actualTokens} onChange={(e) => setTel((t) => ({ ...t, actualTokens: e.target.value.replace(/\D/g, '').slice(0, 9) }))} className="mt-1 w-20 rounded border border-[var(--color-line)] bg-white px-2 py-1" /></label>
            <button onClick={saveTel} disabled={telBusy} className="rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-[var(--color-porcelain)] disabled:opacity-50">{telBusy ? 'Saving…' : 'Save'}</button>
            {gh.connected && !item.githubUrl && <button onClick={async () => { const r = await post({ op: 'github', id: item.id }); if (r.ok) onChange(); else alert(r.error); }} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:bg-white">Push to GitHub</button>}
            {item.githubUrl && <a href={item.githubUrl} target="_blank" rel="noreferrer" className="text-[var(--color-gold-deep)] underline">GitHub ↗</a>}
          </div>
        )}

        {/* Sign-off / reopen — admins only */}
        {isAdmin && (item.status === 'SHIPPED' || item.status === 'IN_REVIEW') && (
          <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-jade)]/40 bg-[var(--color-jade)]/5 p-3 text-xs">
            <span className="text-[var(--color-stone)]">Shipped — review and sign off to close, or reopen for more work.</span>
            <button onClick={signoff} className="ml-auto rounded-full bg-[var(--color-jade)] px-4 py-1.5 font-medium text-white">✓ Sign off &amp; close</button>
            <button onClick={reopen} className="rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:bg-white">Reopen</button>
          </div>
        )}
        {isAdmin && closed && (
          <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-3 text-xs">
            <span className="text-[var(--color-stone)]">Closed by {item.closedBy?.split('@')[0] || '—'}{item.closedAt ? ` · ${day(item.closedAt)}` : ''}.</span>
            <button onClick={reopen} className="ml-auto rounded-full border border-[var(--color-line)] px-3 py-1.5 hover:bg-[var(--color-bone)]">Reopen</button>
          </div>
        )}

        {/* Subtasks */}
        <h3 className="mt-5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Subtasks {item.subtasks.length > 0 && <span className="text-[var(--color-stone-soft)]">{done}/{item.subtasks.length} done</span>}</h3>
        <ul className="mt-2 space-y-1">
          {item.subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm">
              <input type="checkbox" checked={s.status === 'DONE'} onChange={(e) => setSubStatus(s.id, e.target.checked ? 'DONE' : 'TODO')} className="h-4 w-4 accent-[var(--color-jade)]" />
              <span className={s.status === 'DONE' ? 'text-[var(--color-stone-soft)] line-through' : ''}>{s.title}</span>
              {s.ownerInput && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.55rem] font-medium text-amber-800">owner input</span>}
              <span className="ml-auto text-[0.6rem] text-[var(--color-stone-soft)]">{s.assignee === 'claude' ? '◆' : s.assignee.split('@')[0]}{s.status === 'DOING' ? ' · doing' : ''}</span>
              {canManage && s.status !== 'DONE' && <button onClick={() => setSubStatus(s.id, s.status === 'DOING' ? 'TODO' : 'DOING')} className="text-[0.6rem] text-[var(--color-stone)] hover:underline">{s.status === 'DOING' ? '↩' : '▶'}</button>}
            </li>
          ))}
          {item.subtasks.length === 0 && <li className="text-xs text-[var(--color-stone-soft)]">No subtasks yet.</li>}
        </ul>
        {canManage && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={stTitle} onChange={(e) => setStTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="Add a subtask…" className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[var(--color-gold)]" />
            <label className="flex items-center gap-1 text-[0.65rem] text-[var(--color-stone)]"><input type="checkbox" checked={stOwner} onChange={(e) => setStOwner(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-gold)]" /> owner input</label>
            <button onClick={addSub} disabled={stBusy || !stTitle.trim()} className="rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-3 py-1.5 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Add</button>
          </div>
        )}

        {/* Activity / comments */}
        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--color-stone)]">Activity</h3>
        <ul className="mt-2 space-y-1.5 border-l border-[var(--color-line)] pl-3 text-xs text-[var(--color-stone)]">
          {item.events.map((e) => (
            <li key={e.id}><span className="text-[var(--color-ink-soft)]">{e.kind === 'comment' ? '' : `${e.kind}: `}{e.body}</span> <span className="text-[var(--color-stone-soft)]">— {e.actor === 'claude' ? 'Claude' : e.actor.split('@')[0]}, {fmt(e.createdAt)}</span></li>
          ))}
        </ul>
        <CommentBox id={item.id} onDone={onChange} />
      </div>
    </div>
  );
}

function CommentBox({ id, onDone }: { id: string; onDone: () => void }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add a note… (@name to mention)" className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
      <button disabled={busy || !v.trim()} onClick={async () => { setBusy(true); const r = await post({ op: 'comment', id, body: v }); setBusy(false); if (r.ok) { setV(''); onDone(); } }} className="rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-4 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">Note</button>
    </div>
  );
}

// ── Idea quick-add ───────────────────────────────────────────────────────────
function IdeaModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    if (!title.trim()) { setErr('Give the idea a short title.'); return; }
    setBusy(true); setErr('');
    const r = await post({ op: 'create', type: 'IDEA', title: title.trim(), detail: detail.trim() || undefined, urgency: 'P3' });
    setBusy(false);
    if (r.ok) { onDone(); onClose(); } else setErr(r.error || 'Could not add.');
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(42,36,32,0.5)] p-4" onClick={onClose}>
      <div className="my-12 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-porcelain)] p-6 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-[family-name:var(--font-display)] text-xl">💡 Add an idea</h2>
        <p className="mt-1 text-sm text-[var(--color-stone)]">Drop it in — Claude scores it (value/effort) and triages it into the workflow automatically.</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="The idea, in a line" className="mt-4 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} placeholder="Any context, why it matters, links… (optional)" className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-gold)]" />
        {err && <p className="mt-2 text-sm text-[var(--color-blush)]">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-[var(--color-stone)]">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-porcelain)] disabled:opacity-50">{busy ? 'Adding…' : 'Add idea'}</button>
        </div>
      </div>
    </div>
  );
}
