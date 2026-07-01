'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type IpRow = {
  ip: string;
  events: number;
  fails: number;
  lastSeen: string;
  portals: string[];
  devices: string[];
  identifiers: string[];
  types: Record<string, number>;
  blocked: boolean;
  blockReason: string | null;
};
type BlockedRow = { id: string; ip: string; reason: string | null; createdBy: string | null; createdAt: string };

async function post(payload: object) {
  const r = await fetch('/api/admin/security', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Turn a raw User-Agent into a short, human label ("Chrome on Windows").
function deviceLabel(ua: string): string {
  if (!ua) return 'Unknown device';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /bot|crawl|spider|curl|python|wget|httpclient/i.test(ua) ? 'Bot / script' : 'Browser';
  return os ? `${br} on ${os}` : br;
}

export function IpActivity({ rows, blocked }: { rows: IpRow[]; blocked: BlockedRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function act(payload: object) {
    setBusy(true);
    const r = await post(payload);
    setBusy(false);
    if (r.ok) router.refresh();
    else alert(r.error || 'Action failed.');
    return r;
  }
  async function blockManual() {
    if (!manualIp.trim()) return;
    const r = await act({ op: 'blockIp', ip: manualIp.trim(), reason: manualReason.trim() || undefined });
    if (r.ok) { setManualIp(''); setManualReason(''); }
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => r.ip.toLowerCase().includes(t) || r.identifiers.some((i) => i.toLowerCase().includes(t)) || r.devices.some((d) => d.toLowerCase().includes(t)));
  }, [rows, q]);

  return (
    <div className="space-y-8">
      {/* MAC note + manual block */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg">Block an IP address</h2>
        <p className="mb-3 max-w-3xl text-sm text-[var(--color-stone)]">
          A device&rsquo;s <strong>MAC address</strong> never reaches a website — it is a local-network identifier stripped at the first router, so no site can see or log it. The strongest per-device signal available to a server is the <strong>device fingerprint</strong> (browser + operating system), shown in the Device column below. Blocking is therefore by IP address.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[var(--color-stone)]">IP address</span>
            <input value={manualIp} onChange={(e) => setManualIp(e.target.value)} placeholder="e.g. 203.0.113.42" className="w-48 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 font-[family-name:var(--font-mono,monospace)] text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-[var(--color-stone)]">Reason (optional)</span>
            <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="e.g. credential stuffing" className="w-64 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm" />
          </label>
          <button disabled={busy || !manualIp.trim()} onClick={blockManual} className="rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Block</button>
        </div>
      </div>

      {/* Currently blocked */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">Blocked IPs <span className="text-sm text-[var(--color-stone)]">({blocked.length})</span></h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-[var(--color-stone)]">No IPs are currently blocked.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] text-sm">
            {blocked.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-[family-name:var(--font-mono,monospace)]">{b.ip}</span>
                  {b.reason && <span className="text-[var(--color-ink-soft)]"> · {b.reason}</span>}
                  <span className="text-xs text-[var(--color-stone)]"> · blocked {fmt(b.createdAt)}{b.createdBy ? ` by ${b.createdBy}` : ''}</span>
                </span>
                <button disabled={busy} onClick={() => act({ op: 'unblockIp', ip: b.ip })} className="shrink-0 text-xs font-medium text-[var(--color-gold)] hover:underline">Unblock</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity table */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Recent activity by IP <span className="text-sm text-[var(--color-stone)]">(7 days)</span></h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter IP, email or device…" className="w-64 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-stone)]">No IP activity recorded in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-stone)]">
                  <th className="py-2 pr-3 font-medium">IP address</th>
                  <th className="py-2 pr-3 font-medium">Device(s)</th>
                  <th className="py-2 pr-3 font-medium">Events</th>
                  <th className="py-2 pr-3 font-medium">Fails</th>
                  <th className="py-2 pr-3 font-medium">Portals</th>
                  <th className="py-2 pr-3 font-medium">Last seen</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const open = expanded === r.ip;
                  return (
                    <Fragment key={r.ip}>
                      <tr className="border-b border-[var(--color-line)]/60 align-top">
                        <td className="py-2 pr-3">
                          <button onClick={() => setExpanded(open ? null : r.ip)} className="text-left font-[family-name:var(--font-mono,monospace)] hover:underline">
                            {r.ip}
                          </button>
                          {r.blocked && <span className="ml-2 rounded-full bg-[var(--color-blush)]/15 px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide text-[var(--color-blush)]">Blocked</span>}
                        </td>
                        <td className="py-2 pr-3 text-[var(--color-ink-soft)]">
                          {r.devices.length === 0 ? <span className="text-[var(--color-stone)]">—</span> : deviceLabel(r.devices[0])}
                          {r.devices.length > 1 && <span className="text-xs text-[var(--color-stone)]"> +{r.devices.length - 1}</span>}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{r.events}</td>
                        <td className={`py-2 pr-3 tabular-nums ${r.fails > 5 ? 'text-amber-600' : ''}`}>{r.fails}</td>
                        <td className="py-2 pr-3 text-xs text-[var(--color-stone)]">{r.portals.join(', ') || '—'}</td>
                        <td className="py-2 pr-3 text-xs text-[var(--color-stone)]">{fmt(r.lastSeen)}</td>
                        <td className="py-2 text-right">
                          {r.blocked ? (
                            <button disabled={busy} onClick={() => act({ op: 'unblockIp', ip: r.ip })} className="text-xs font-medium text-[var(--color-gold)] hover:underline">Unblock</button>
                          ) : (
                            <button disabled={busy} onClick={() => act({ op: 'blockIp', ip: r.ip, reason: `${r.fails} failed events in 7d` })} className="text-xs font-medium text-[var(--color-blush)] hover:underline">Block</button>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-[var(--color-line)]/60 bg-[var(--color-bone)]/40">
                          <td colSpan={7} className="px-3 py-3 text-xs">
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div>
                                <p className="mb-1 font-medium text-[var(--color-stone)]">Event types</p>
                                <ul className="space-y-0.5">{Object.entries(r.types).map(([t, n]) => <li key={t}>{t}: <span className="tabular-nums">{n}</span></li>)}</ul>
                              </div>
                              <div>
                                <p className="mb-1 font-medium text-[var(--color-stone)]">Accounts attempted</p>
                                {r.identifiers.length === 0 ? <p className="text-[var(--color-stone)]">—</p> : <ul className="space-y-0.5">{r.identifiers.map((i) => <li key={i} className="break-all">{i}</li>)}</ul>}
                              </div>
                              <div>
                                <p className="mb-1 font-medium text-[var(--color-stone)]">Devices (User-Agent)</p>
                                {r.devices.length === 0 ? <p className="text-[var(--color-stone)]">—</p> : <ul className="space-y-1">{r.devices.map((d, i) => <li key={i} className="break-all text-[var(--color-ink-soft)]">{deviceLabel(d)} <span className="text-[var(--color-stone)]">— {d}</span></li>)}</ul>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
