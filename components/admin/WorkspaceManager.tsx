'use client';

import { useTransition } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkspaceOverview, WorkspaceUser, WorkspaceGroup } from '@/lib/google-workspace';

// Read-only directory view (BLD-312 Phase A). All data is fetched server-side and
// passed in; this component only presents it and offers a refresh. Write actions
// (create / suspend / alias / group) land in Phase B.

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

export function WorkspaceManager({ overview }: { overview: WorkspaceOverview }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const refresh = () => start(() => router.refresh());

  const refreshBtn = (
    <button
      onClick={refresh}
      disabled={pending}
      className="rounded-[var(--radius-sm)] border border-[var(--color-sand)] px-3 py-1.5 text-sm hover:bg-[var(--color-bone)] disabled:opacity-50"
    >
      {pending ? 'Refreshing…' : 'Refresh'}
    </button>
  );

  // ── Not configured: point to the credentials screen + setup runbook ──
  if (!overview.configured) {
    return (
      <div className="mt-6 max-w-2xl rounded-[var(--radius-sm)] border border-[var(--color-sand)] bg-[var(--color-bone)]/40 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Not connected yet</h2>
        <p className="mt-2 text-sm text-[var(--color-stone)]">
          To manage Workspace accounts here, add a Google service-account key with domain-wide delegation, then the
          super-admin it should act as. Both are entered on the Credentials &amp; keys screen.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--color-ink)]">
          <li>Follow <code className="rounded bg-[var(--color-bone)] px-1">docs/WORKSPACE_ADMIN_SDK_SETUP.md</code> to create the service account and authorise it.</li>
          <li>In <a className="text-[var(--color-gold-deep,#856a4a)] underline" href="/admin/settings/credentials">Credentials &amp; keys</a>, set <code className="rounded bg-[var(--color-bone)] px-1">GOOGLE_WORKSPACE_SA_KEY</code> (paste the JSON) and <code className="rounded bg-[var(--color-bone)] px-1">GOOGLE_WORKSPACE_ADMIN_EMAIL</code>.</li>
          <li>Come back here — this page will list your users, groups and aliases.</li>
        </ol>
      </div>
    );
  }

  // ── Configured but Google rejected the call: show the actionable reason ──
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
          <p className="mt-3 text-sm text-[var(--color-stone)]">
            Fix the cause above, then click Refresh. Credentials live in{' '}
            <a className="underline" href="/admin/settings/credentials">Credentials &amp; keys</a>.
          </p>
        </div>
      </div>
    );
  }

  const { users, groups } = overview;
  const suspended = users.filter((u) => u.suspended).length;
  const admins = users.filter((u) => u.admin).length;
  const active = users.length - suspended;

  return (
    <div className="mt-6 space-y-8">
      {/* Summary + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="green">{active} active</Pill>
        {suspended > 0 && <Pill tone="amber">{suspended} suspended</Pill>}
        {admins > 0 && <Pill>{admins} admin{admins === 1 ? '' : 's'}</Pill>}
        <Pill>{groups.length} group{groups.length === 1 ? '' : 's'}</Pill>
        <Pill tone="blush">Read-only · Phase A</Pill>
        <span className="text-sm text-[var(--color-stone)]">Impersonating {overview.adminEmail ?? '—'}</span>
        <span className="ml-auto">{refreshBtn}</span>
      </div>

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
              </tr>
            </thead>
            <tbody>
              {users.map((u: WorkspaceUser) => (
                <tr key={u.id} className="border-t border-[var(--color-sand)]/60">
                  <td className="px-3 py-2 font-medium">{u.email}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{u.name || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {u.suspended ? <Pill tone="amber">Suspended</Pill> : <Pill tone="green">Active</Pill>}
                      {u.admin && <Pill>Admin</Pill>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">
                    {u.aliases.length ? u.aliases.join(', ') : '—'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--color-stone)]">No users found.</td></tr>
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
              </tr>
            </thead>
            <tbody>
              {groups.map((g: WorkspaceGroup) => (
                <tr key={g.id} className="border-t border-[var(--color-sand)]/60">
                  <td className="px-3 py-2 font-medium">{g.email}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{g.name || '—'}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{g.memberCount ?? '—'}</td>
                  <td className="px-3 py-2 text-[var(--color-stone)]">{g.aliases.length ? g.aliases.join(', ') : '—'}</td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-[var(--color-stone)]">No groups yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
