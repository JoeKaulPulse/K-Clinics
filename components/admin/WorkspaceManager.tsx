'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceOverview, WorkspaceUser, WorkspaceGroup } from '@/lib/google-workspace';
import {
  createUserAction, setSuspendedAction, addAliasAction, removeAliasAction,
  createGroupAction, addMemberAction, removeMemberAction,
} from '@/app/admin/workspace/actions';

// Workspace directory + provisioning UI (BLD-312 Phase A read + Phase B writes).
// Reads come from the server (props); writes call the gated, audited server
// actions and refresh the view. No hard delete is offered — suspend is the
// reversible control, in keeping with the no-data-loss migration.

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'blush' }) {
  const cls = {
    neutral: 'bg-[var(--color-bone)] text-[var(--color-stone)]',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    blush: 'bg-[var(--color-blush)]/20 text-[var(--color-ink)]',
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

const btn = 'rounded-[var(--radius-sm)] border border-[var(--color-sand)] px-2.5 py-1 text-xs hover:bg-[var(--color-bone)] disabled:opacity-50';
const btnPrimary = 'rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-3 py-1.5 text-sm text-[var(--color-porcelain)] hover:opacity-90 disabled:opacity-50';
const field = 'rounded-[var(--radius-sm)] border border-[var(--color-sand)] px-2 py-1.5 text-sm';

export function WorkspaceManager({ overview, staffMissingMailbox = [] }: { overview: WorkspaceOverview; staffMissingMailbox?: { email: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [tempPw, setTempPw] = useState<{ email: string; password: string } | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [cu, setCu] = useState({ email: '', first: '', last: '' });
  const [cg, setCg] = useState({ email: '', name: '', description: '' });

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, successText: string) {
    setBusy(true); setNotice(null);
    try {
      const r = await fn();
      if (r.ok) { setNotice({ ok: true, text: successText }); router.refresh(); }
      else setNotice({ ok: false, text: r.error || 'Something went wrong.' });
    } catch {
      setNotice({ ok: false, text: 'The request failed. Try again.' });
    } finally { setBusy(false); }
  }

  async function submitCreateUser(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setNotice(null); setTempPw(null);
    try {
      const r = await createUserAction({ email: cu.email.trim(), firstName: cu.first.trim(), lastName: cu.last.trim() });
      if (r.ok) {
        if (r.tempPassword) setTempPw({ email: cu.email.trim(), password: r.tempPassword });
        setNotice({ ok: true, text: `Created ${cu.email.trim()}` });
        setShowAddUser(false); setCu({ email: '', first: '', last: '' });
        router.refresh();
      } else setNotice({ ok: false, text: r.error || 'Could not create the mailbox.' });
    } catch { setNotice({ ok: false, text: 'The request failed. Try again.' }); }
    finally { setBusy(false); }
  }

  async function submitCreateGroup(e: FormEvent) {
    e.preventDefault();
    await run(() => createGroupAction({ email: cg.email.trim(), name: cg.name.trim(), description: cg.description.trim() || undefined }), `Created group ${cg.email.trim()}`);
    setShowAddGroup(false); setCg({ email: '', name: '', description: '' });
  }

  const toggleSuspend = (u: WorkspaceUser) => {
    if (!u.suspended && !window.confirm(`Suspend ${u.email}? They lose access immediately. This is reversible.`)) return;
    run(() => setSuspendedAction(u.email, !u.suspended), u.suspended ? `Restored ${u.email}` : `Suspended ${u.email}`);
  };
  const addAlias = (email: string) => {
    const a = window.prompt(`New alias for ${email} — enter the full address:`, '');
    if (a && a.trim()) run(() => addAliasAction(email, a.trim()), `Added alias ${a.trim()}`);
  };
  const removeAlias = (email: string, alias: string) => {
    if (window.confirm(`Remove alias ${alias} from ${email}?`)) run(() => removeAliasAction(email, alias), `Removed alias ${alias}`);
  };
  const addMember = (group: string) => {
    const m = window.prompt(`Add a member to ${group} — enter their email:`, '');
    if (m && m.trim()) run(() => addMemberAction(group, m.trim()), `Added ${m.trim()} to ${group}`);
  };
  const removeMember = (group: string) => {
    const m = window.prompt(`Remove a member from ${group} — enter their email:`, '');
    if (m && m.trim()) run(() => removeMemberAction(group, m.trim()), `Removed ${m.trim()} from ${group}`);
  };
  const prefillFromStaff = (s: { email: string; name: string }) => {
    const [first, ...rest] = s.name.trim().split(/\s+/);
    setCu({ email: s.email, first: first || s.name, last: rest.join(' ') || first || s.name });
    setShowAddUser(true); setNotice(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refreshBtn = (
    <button onClick={() => run(async () => ({ ok: true }), 'Refreshed')} disabled={busy} className={btn}>
      {busy ? 'Working…' : 'Refresh'}
    </button>
  );

  // ── Not configured ──
  if (!overview.configured) {
    return (
      <div className="mt-6 max-w-2xl rounded-[var(--radius-sm)] border border-[var(--color-sand)] bg-[var(--color-bone)]/40 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Not connected yet</h2>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          To manage Workspace accounts here, add a Google service-account key with domain-wide delegation, then the
          super-admin it should act as.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--color-ink)]">
          <li>Follow <code className="rounded bg-[var(--color-bone)] px-1">docs/WORKSPACE_ADMIN_SDK_SETUP.md</code> to create and authorise the service account.</li>
          <li>In <a className="underline" href="/admin/settings/credentials">Credentials &amp; keys</a>, set <code className="rounded bg-[var(--color-bone)] px-1">GOOGLE_WORKSPACE_SA_KEY</code> and <code className="rounded bg-[var(--color-bone)] px-1">GOOGLE_WORKSPACE_ADMIN_EMAIL</code>.</li>
          <li>Return here to list and manage your users, groups and aliases.</li>
        </ol>
      </div>
    );
  }

  // ── Configured but rejected ──
  if (!overview.ok) {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-stone)]">Impersonating {overview.adminEmail ?? '—'}</p>
          {refreshBtn}
        </div>
        <div className="max-w-2xl rounded-[var(--radius-sm)] border border-[var(--color-blush)]/50 bg-[var(--color-blush)]/10 p-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Couldn’t reach the directory</h2>
          <p className="mt-2 text-sm text-[var(--color-ink)]">{overview.error ?? 'Unknown error.'}</p>
          <p className="mt-3 text-sm text-[var(--color-stone)]">Fix the cause above, then Refresh. Credentials live in <a className="underline" href="/admin/settings/credentials">Credentials &amp; keys</a>.</p>
        </div>
      </div>
    );
  }

  const { users, groups } = overview;
  const suspended = users.filter((u) => u.suspended).length;
  const admins = users.filter((u) => u.admin).length;
  const active = users.length - suspended;

  return (
    <div className="mt-6 space-y-6">
      {/* Summary + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="green">{active} active</Pill>
        {suspended > 0 && <Pill tone="amber">{suspended} suspended</Pill>}
        {admins > 0 && <Pill>{admins} admin{admins === 1 ? '' : 's'}</Pill>}
        <Pill>{groups.length} group{groups.length === 1 ? '' : 's'}</Pill>
        <span className="text-sm text-[var(--color-stone)]">Impersonating {overview.adminEmail ?? '—'}</span>
        <span className="ml-auto flex gap-2">
          <button onClick={() => { setShowAddUser((v) => !v); setShowAddGroup(false); }} disabled={busy} className={btnPrimary}>＋ Add user</button>
          <button onClick={() => { setShowAddGroup((v) => !v); setShowAddUser(false); }} disabled={busy} className={btn}>＋ Create group</button>
          {refreshBtn}
        </span>
      </div>

      {/* Notices */}
      {notice && (
        <p className={`rounded-[var(--radius-sm)] border px-4 py-2 text-sm ${notice.ok ? 'border-green-600/30 bg-green-50 text-green-800' : 'border-[var(--color-blush)]/50 bg-[var(--color-blush)]/10 text-[var(--color-ink)]'}`}>{notice.text}</p>
      )}
      {tempPw && (
        <div className="rounded-[var(--radius-sm)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Temporary password for {tempPw.email}</p>
          <p className="mt-1 flex items-center gap-2">
            <code className="rounded bg-white/70 px-2 py-1 font-mono">{tempPw.password}</code>
            <button className={btn} onClick={() => navigator.clipboard?.writeText(tempPw.password)}>Copy</button>
            <button className={btn} onClick={() => setTempPw(null)}>Dismiss</button>
          </p>
          <p className="mt-1 text-amber-800">Share this securely (one-time link / password manager) — they’ll be asked to change it at first sign-in. It won’t be shown again.</p>
        </div>
      )}

      {/* Add user form */}
      {showAddUser && (
        <form onSubmit={submitCreateUser} className="flex flex-wrap items-end gap-3 rounded-[var(--radius-sm)] border border-[var(--color-sand)] bg-[var(--color-bone)]/30 p-4">
          <label className="flex flex-col text-xs text-[var(--color-stone)]">First name<input required value={cu.first} onChange={(e) => setCu({ ...cu, first: e.target.value })} className={field} /></label>
          <label className="flex flex-col text-xs text-[var(--color-stone)]">Last name<input required value={cu.last} onChange={(e) => setCu({ ...cu, last: e.target.value })} className={field} /></label>
          <label className="flex flex-col text-xs text-[var(--color-stone)]">Email<input required type="email" placeholder="name@kclinics.co.uk" value={cu.email} onChange={(e) => setCu({ ...cu, email: e.target.value })} className={`${field} min-w-[16rem]`} /></label>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Creating…' : 'Create mailbox'}</button>
          <button type="button" onClick={() => setShowAddUser(false)} className={btn}>Cancel</button>
        </form>
      )}

      {/* Create group form */}
      {showAddGroup && (
        <form onSubmit={submitCreateGroup} className="flex flex-wrap items-end gap-3 rounded-[var(--radius-sm)] border border-[var(--color-sand)] bg-[var(--color-bone)]/30 p-4">
          <label className="flex flex-col text-xs text-[var(--color-stone)]">Group name<input required value={cg.name} onChange={(e) => setCg({ ...cg, name: e.target.value })} className={field} /></label>
          <label className="flex flex-col text-xs text-[var(--color-stone)]">Group email<input required type="email" placeholder="hello@kclinics.co.uk" value={cg.email} onChange={(e) => setCg({ ...cg, email: e.target.value })} className={`${field} min-w-[16rem]`} /></label>
          <label className="flex flex-col text-xs text-[var(--color-stone)]">Description<input value={cg.description} onChange={(e) => setCg({ ...cg, description: e.target.value })} className={field} /></label>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Creating…' : 'Create group'}</button>
          <button type="button" onClick={() => setShowAddGroup(false)} className={btn}>Cancel</button>
        </form>
      )}

      {/* Staff without a mailbox */}
      {staffMissingMailbox.length > 0 && (
        <div className="rounded-[var(--radius-sm)] border border-amber-300 bg-amber-50/60 p-4">
          <h2 className="text-sm font-medium text-amber-900">Active staff without a mailbox ({staffMissingMailbox.length})</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {staffMissingMailbox.map((s) => (
              <li key={s.email}>
                <button onClick={() => prefillFromStaff(s)} className={btn} title={`Create a mailbox for ${s.name}`}>
                  {s.name || s.email} · {s.email} →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Users */}
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Users ({users.length})</h2>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-sand)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bone)] text-[var(--color-stone)]">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Last sign-in</th>
                <th className="px-3 py-2 font-medium">Aliases</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--color-sand)]/60 align-top">
                  <td className="px-3 py-2 font-medium">{u.email}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{u.name || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {u.suspended ? <Pill tone="amber">Suspended</Pill> : <Pill tone="green">Active</Pill>}
                      {u.admin && <Pill>Admin</Pill>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap items-center gap-1">
                      {u.aliases.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bone)] px-2 py-0.5 text-xs text-[var(--color-ink)]">
                          {a}
                          <button onClick={() => removeAlias(u.email, a)} disabled={busy} title="Remove alias" className="text-[var(--color-stone)] hover:text-[var(--color-ink)]">×</button>
                        </span>
                      ))}
                      <button onClick={() => addAlias(u.email)} disabled={busy} className={btn} title="Add alias">＋</button>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleSuspend(u)} disabled={busy} className={btn}>
                      {u.suspended ? 'Restore' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-[var(--color-stone)]">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Groups */}
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-xl">Groups &amp; shared inboxes ({groups.length})</h2>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-sand)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-bone)] text-[var(--color-stone)]">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Members</th>
                <th className="px-3 py-2 font-medium">Aliases</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g: WorkspaceGroup) => (
                <tr key={g.id} className="border-t border-[var(--color-sand)]/60">
                  <td className="px-3 py-2 font-medium">{g.email}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{g.name || '—'}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{g.memberCount ?? '—'}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{g.aliases.length ? g.aliases.join(', ') : '—'}</td>
                  <td className="px-3 py-2">
                    <span className="flex gap-1">
                      <button onClick={() => addMember(g.email)} disabled={busy} className={btn}>＋ Member</button>
                      <button onClick={() => removeMember(g.email)} disabled={busy} className={btn}>－ Member</button>
                    </span>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--color-stone)]">No groups yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
