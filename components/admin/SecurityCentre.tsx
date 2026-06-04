'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';

type Severity = 'ok' | 'warn' | 'critical' | 'info';
type Check = { label: string; severity: Severity; detail: string; group: string };
type Threats = {
  failed24h: number; lockouts24h: number; rateLimited24h: number; captchaFails24h: number; twofaFails24h: number;
  lockedNow: { identifier: string; fails: number }[];
  topIps: { ip: string; fails: number }[];
  recent: { id: string; type: string; portal: string; identifier: string | null; ip: string | null; createdAt: string }[];
};
const ROLES = ['OWNER', 'ADMIN', 'PRACTITIONER', 'FRONT_DESK', 'STAFF'];

const dot: Record<Severity, string> = { ok: 'bg-emerald-500', info: 'bg-sky-400', warn: 'bg-amber-400', critical: 'bg-[var(--color-blush)]' };
const chip: Record<Severity, string> = { ok: 'text-emerald-700', info: 'text-sky-700', warn: 'text-amber-700', critical: 'text-[var(--color-blush)]' };

async function post(payload: object) {
  const r = await fetch('/api/admin/security', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json().catch(() => ({ ok: false }));
}
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function SecurityCentre({ score, checks, policy, threats }: { score: number; checks: Check[]; policy: string[]; threats: Threats }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<string[]>(policy);
  const [secret, setSecret] = useState('');

  const groups = useMemo(() => {
    const m = new Map<string, Check[]>();
    for (const c of checks) { if (!m.has(c.group)) m.set(c.group, []); m.get(c.group)!.push(c); }
    return [...m.entries()];
  }, [checks]);
  const flags = checks.filter((c) => c.severity === 'warn' || c.severity === 'critical');

  async function act(payload: object) { setBusy(true); const r = await post(payload); setBusy(false); if (r.ok) router.refresh(); else alert(r.error || 'Failed.'); return r; }
  async function genSecret() { setBusy(true); const r = await post({ op: 'generateSecret' }); setBusy(false); if (r.ok) setSecret(r.value); }

  // Step up with a passkey (purpose-scoped), then run the manual key rotation.
  async function runReencrypt() {
    if (!confirm('Run a key re-encryption batch now? This re-encrypts stored personal data under the current key.')) return;
    setBusy(true);
    try {
      const o = await fetch('/api/admin/security/passkey/auth-options', { method: 'POST' }).then((r) => r.json());
      if (!o.ok) { alert(o.error || 'No passkey registered. Add one on the Data export page first.'); return; }
      const resp = await startAuthentication({ optionsJSON: o.options });
      const v = await fetch('/api/admin/security/passkey/auth-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: resp, purpose: 'rotate-keys' }),
      }).then((r) => r.json());
      if (!v.ok) { alert(v.error || 'Passkey verification failed.'); return; }
      const r = await post({ op: 'reencrypt' });
      if (r.ok) { alert(`Re-encrypted ${r.migrated ?? 0}; ${r.remaining ?? 0} remaining.`); router.refresh(); }
      else alert(r.error || 'Re-encryption failed.');
    } catch {
      alert('Passkey verification was cancelled.');
    } finally { setBusy(false); }
  }
  function toggleRole(role: string) { setRoles((rs) => (rs.includes(role) ? rs.filter((x) => x !== role) : [...rs, role])); }

  const scoreColor = score >= 85 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-[var(--color-blush)]';

  return (
    <div className="space-y-8">
      {/* Score + threat stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4 lg:col-span-1">
          <p className="text-xs uppercase tracking-wide text-[var(--color-stone-soft)]">Posture</p>
          <p className={`font-[family-name:var(--font-display)] text-3xl ${scoreColor}`}>{score}<span className="text-base text-[var(--color-stone-soft)]">/100</span></p>
        </div>
        {[
          { l: 'Failed logins (24h)', v: threats.failed24h, warn: threats.failed24h > 20 },
          { l: 'Lockouts (24h)', v: threats.lockouts24h, warn: threats.lockouts24h > 0 },
          { l: 'Rate-limited (24h)', v: threats.rateLimited24h, warn: threats.rateLimited24h > 0 },
          { l: '2FA failures (24h)', v: threats.twofaFails24h, warn: threats.twofaFails24h > 5 },
          { l: 'CAPTCHA fails (24h)', v: threats.captchaFails24h, warn: false },
        ].map((s) => (
          <div key={s.l} className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-stone-soft)]">{s.l}</p>
            <p className={`font-[family-name:var(--font-display)] text-2xl ${s.warn ? 'text-amber-600' : ''}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Warning flags */}
      {flags.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-amber-900">⚠ {flags.length} item{flags.length === 1 ? '' : 's'} need attention</h2>
          <ul className="mt-3 space-y-2">
            {flags.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[c.severity]}`} />
                <span><strong className={chip[c.severity]}>{c.label}:</strong> <span className="text-[var(--color-ink-soft)]">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Live threats */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Locked accounts (now)">
          {threats.lockedNow.length === 0 ? <Empty>No accounts are locked.</Empty> : (
            <ul className="divide-y divide-[var(--color-line)]">
              {threats.lockedNow.map((l) => (
                <li key={l.identifier} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{l.identifier} <span className="text-xs text-[var(--color-stone-soft)]">· {l.fails} fails</span></span>
                  <button disabled={busy} onClick={() => act({ op: 'unlock', identifier: l.identifier })} className="shrink-0 text-xs font-medium text-[var(--color-gold)] hover:underline">Unlock</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Top offending IPs (7 days)">
          {threats.topIps.length === 0 ? <Empty>No notable IP activity.</Empty> : (
            <ul className="divide-y divide-[var(--color-line)]">
              {threats.topIps.map((i) => (
                <li key={i.ip} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-[family-name:var(--font-mono,monospace)]">{i.ip} <span className="text-xs text-[var(--color-stone-soft)]">· {i.fails} fails</span></span>
                  <button disabled={busy} onClick={() => act({ op: 'unlock', ip: i.ip })} className="shrink-0 text-xs font-medium text-[var(--color-gold)] hover:underline">Clear</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Posture checklist */}
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map(([group, items]) => (
          <Panel key={group} title={group}>
            <ul className="space-y-2.5">
              {items.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[c.severity]}`} />
                  <span><span className="font-medium">{c.label}</span><br /><span className="text-xs text-[var(--color-stone)]">{c.detail}</span></span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      {/* Controls */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Require 2FA by role">
          <p className="mb-3 text-sm text-[var(--color-stone)]">Staff in a ticked role must set up two-factor authentication before they can sign in.</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <label key={r} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${roles.includes(r) ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-porcelain)]' : 'border-[var(--color-line)]'}`}>
                <input type="checkbox" className="sr-only" checked={roles.includes(r)} onChange={() => toggleRole(r)} />{r}
              </label>
            ))}
          </div>
          <button disabled={busy} onClick={() => act({ op: 'set2faPolicy', roles })} className="mt-4 rounded-full bg-[var(--color-ink)] px-5 py-2 text-sm text-[var(--color-porcelain)] disabled:opacity-50">Save policy</button>
        </Panel>

        <Panel title="Key regeneration & rotation">
          <p className="text-sm text-[var(--color-stone)]">Generate a strong value to paste into the matching environment variable in Vercel (then redeploy). Rotating a session secret signs everyone out; rotating the health key requires the keyring runbook.</p>
          <button disabled={busy} onClick={genSecret} className="mt-3 rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs hover:border-[var(--color-gold)]">Generate a new secret</button>
          {secret && <code className="mt-2 block break-all rounded-[var(--radius-sm)] bg-[var(--color-bone)] px-3 py-2 text-xs">{secret}</code>}
          <button disabled={busy} onClick={runReencrypt} className="mt-3 block rounded-full border border-[var(--color-line)] px-4 py-1.5 text-xs hover:border-[var(--color-gold)]">Run key re-encryption batch</button>
          <p className="mt-2 text-xs text-[var(--color-stone-soft)]">Re-encryption touches all stored personal data, so it asks for your passkey (Face ID / Touch ID) first.</p>
        </Panel>
      </div>

      {/* Recent events */}
      <Panel title="Recent security events">
        {threats.recent.length === 0 ? <Empty>No recent events.</Empty> : (
          <ul className="divide-y divide-[var(--color-line)] text-sm">
            {threats.recent.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide text-[var(--color-stone)]">{e.type}</span> <span className="text-[var(--color-ink-soft)]">{e.identifier || e.ip || '—'}</span> <span className="text-xs text-[var(--color-stone-soft)]">· {e.portal}</span></span>
                <span className="text-xs text-[var(--color-stone-soft)]">{fmt(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-porcelain)] p-5">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-lg">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--color-stone-soft)]">{children}</p>;
}
