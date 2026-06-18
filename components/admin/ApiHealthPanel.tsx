'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Live traffic-light panel for /admin/api-health. Server renders the last
// stored report instantly; this panel immediately re-probes every API with
// real calls and keeps a Re-check button + optional 60s auto refresh.

type Light = 'green' | 'amber' | 'red' | 'grey';
type Check = {
  id: string; label: string; category: string; probe: string; critical?: boolean;
  light: Light; detail: string; latencyMs: number | null; info?: string[]; since: string;
};
type Report = {
  generatedAt: string; env: string; commit: string; durationMs: number;
  overall: Light; counts: Record<Light, number>; checks: Check[];
};

const DOT: Record<Light, string> = {
  green: 'bg-[var(--color-jade)]',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  grey: 'bg-[var(--color-stone-soft)]',
};
const LABEL: Record<Light, string> = { green: 'Healthy', amber: 'Attention', red: 'Failing', grey: 'Not set up' };

function fmtAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function ApiHealthPanel({ initial }: { initial: Report | null }) {
  const [report, setReport] = useState<Report | null>(initial);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const inflight = useRef(false);

  const runChecks = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/api-health', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok && j.report) setReport(j.report as Report);
      else setError(j.error || `Health run failed (HTTP ${res.status}).`);
    } catch {
      setError('Could not reach the health endpoint — are you offline?');
    } finally {
      inflight.current = false;
      setChecking(false);
    }
  }, []);

  // Probe live on first open — the server-rendered report may be stale.
  useEffect(() => { void runChecks(); }, [runChecks]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => { void runChecks(); }, 60_000);
    return () => clearInterval(t);
  }, [auto, runChecks]);

  const groups = new Map<string, Check[]>();
  for (const c of report?.checks ?? []) {
    const list = groups.get(c.category) ?? [];
    list.push(c);
    groups.set(c.category, list);
  }

  return (
    <div>
      {/* Overall banner + controls */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {report && (
          <span className="inline-flex items-center gap-3 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-sm">
            <span className={`h-3 w-3 rounded-full ${DOT[report.overall]} ${checking ? 'animate-pulse' : ''}`} />
            <span className="font-medium">{checking ? 'Re-checking…' : LABEL[report.overall]}</span>
            <span className="text-[var(--color-stone)]">
              {(['red', 'amber', 'green', 'grey'] as Light[]).map((l) => `${report.counts[l]} ${LABEL[l].toLowerCase()}`).join(' · ')}
            </span>
          </span>
        )}
        {!report && (
          <span className="inline-flex items-center gap-3 rounded-full border border-[var(--color-line)] bg-[var(--color-porcelain)] px-4 py-2 text-sm">
            <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--color-stone-soft)]" />
            Running the first checks…
          </span>
        )}
        <button
          type="button"
          onClick={() => void runChecks()}
          disabled={checking}
          className="rounded-full border border-[var(--color-line)] bg-[var(--color-ink)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Re-check now'}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-stone)]">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[var(--color-ink)]" />
          Auto re-check every minute
        </label>
        {report && (
          <span className="text-xs text-[var(--color-stone)]">
            Last run {fmtAgo(report.generatedAt)} · took {(report.durationMs / 1000).toFixed(1)}s · {report.env} · {report.commit}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* Category cards */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {[...groups.entries()].map(([category, checks]) => {
          const groupLight = checks.reduce<Light>((acc, c) => (({ red: 3, amber: 2, grey: 1, green: 0 }[c.light] > { red: 3, amber: 2, grey: 1, green: 0 }[acc]) ? c.light : acc), 'green');
          return (
            <section key={category} className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)]">
              <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-5 py-3.5">
                <span className={`h-3 w-3 rounded-full ${DOT[groupLight]}`} />
                <h2 className="font-[family-name:var(--font-display)] text-lg">{category}</h2>
              </div>
              <ul className="divide-y divide-[var(--color-line)]">
                {checks.map((c) => (
                  <li key={c.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.light]} ${checking ? 'opacity-60' : ''}`} title={LABEL[c.light]} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className="font-medium">
                            {c.label}
                            {c.critical && <span className="ml-2 rounded-full border border-[var(--color-line)] px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-[var(--color-stone)]">critical</span>}
                          </p>
                          <p className="text-sm text-[var(--color-stone)]">
                            {c.detail}
                            {typeof c.latencyMs === 'number' && <span className="text-[var(--color-stone)]"> · {c.latencyMs}ms</span>}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--color-stone)]">
                          Probe: {c.probe} · {LABEL[c.light].toLowerCase()} since {fmtAgo(c.since)}
                        </p>
                        {c.info && c.info.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {c.info.map((line, k) => (
                              <li key={k} className="text-xs text-[var(--color-stone)]">{line}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-[var(--color-stone)]">
        Every row is a real, read-only API call made just now from the live server — an invalid key, an expired
        token or a retired API version shows red here even when the configuration looks complete. No secrets are
        ever shown, and no probe writes, sends or charges anything.
      </p>
    </div>
  );
}
